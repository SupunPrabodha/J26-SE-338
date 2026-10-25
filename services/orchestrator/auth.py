import hashlib
import secrets
from datetime import timedelta
from uuid import UUID, uuid4

import jwt
from fastapi import Depends, Request, Response
from fastapi.security import APIKeyCookie
from pwdlib import PasswordHash
from research_common.audit import record as audit
from research_common.config import settings
from research_common.database import Account, AuthSession, session
from research_common.web import SafeError, redis_client
from research_contracts import ErrorCode, Role, now
from sqlalchemy import select, update
from sqlalchemy.orm import Session

passwords = PasswordHash.recommended()
dummy_password_hash = passwords.hash(secrets.token_urlsafe(32))
ISSUER = "j26-development-identity"
AUDIENCE = "j26-orchestrator"
access_cookie = APIKeyCookie(name="j26_access", auto_error=False)


def claims(account, jti, audience=AUDIENCE, lifetime=None):
    issued = now()
    return {
        "sub": account.id,
        "role": account.role,
        "iss": ISSUER,
        "aud": audience,
        "iat": issued,
        "exp": issued + timedelta(seconds=lifetime or settings().access_seconds),
        "jti": jti,
    }


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def issue(db, account, response, family=None, remembered=False, absolute_expires_at=None):
    access_jti, refresh = str(uuid4()), secrets.token_urlsafe(48)
    # Only credentialled staff can opt in. Never extend student ownership or consent.
    remembered = bool(remembered and account.role in {"ADMIN", "COUNSELLOR", "RESEARCHER"})
    instant = now()
    if remembered:
        absolute_expires_at = absolute_expires_at or instant + timedelta(
            seconds=settings().remembered_session_seconds
        )
        expires = absolute_expires_at
    else:
        absolute_expires_at = None
        expires = instant + timedelta(seconds=settings().refresh_seconds)
    if account.expires_at:
        expires = min(expires, account.expires_at)
    refresh_age = (
        max(0, int((expires - instant).total_seconds()))
        if remembered
        else settings().refresh_seconds
    )
    db.add(
        AuthSession(
            account_id=account.id,
            access_jti=access_jti,
            refresh_hash=digest(refresh),
            family_id=family or str(uuid4()),
            expires_at=expires,
            remembered=remembered,
            absolute_expires_at=absolute_expires_at,
        )
    )
    access = jwt.encode(
        claims(account, access_jti), settings().jwt_secret.get_secret_value(), algorithm="HS256"
    )
    for name, value, age in [
        ("j26_access", access, settings().access_seconds),
        ("j26_refresh", refresh, refresh_age),
    ]:
        response.set_cookie(
            name,
            value,
            max_age=age,
            httponly=True,
            secure=settings().cookie_secure,
            samesite="strict",
            path="/api/v1",
        )


def csrf(request: Request):
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        origin = request.headers.get("origin")
        if (
            origin not in settings().allowed_origins.split(",")
            or request.headers.get("x-requested-with") != "j26-browser"
        ):
            raise SafeError(ErrorCode.FORBIDDEN, 403)


def account_valid(account):
    return (
        account and account.enabled and (account.expires_at is None or account.expires_at > now())
    )


def usable_staff(account):
    return bool(account_valid(account) and account.username and account.password_hash)


def lock_valid_account(db, account, request, role):
    """After domain locks, refresh account/session state before a protected mutation/read."""
    fresh = db.scalar(
        select(Account)
        .where(Account.id == account.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if not account_valid(fresh) or fresh.role != role:
        raise SafeError(ErrorCode.AUTH_INVALID, 401)
    session_id = (
        getattr(request.state, "auth_session_id", None)
        if request
        else db.info.get("auth_session_id")
    )
    if session_id:
        record = db.get(AuthSession, session_id, populate_existing=True)
        if (
            not record
            or record.account_id != fresh.id
            or record.revoked
            or record.expires_at <= now()
            or (
                record.remembered
                and (record.absolute_expires_at is None or record.absolute_expires_at <= now())
            )
        ):
            raise SafeError(ErrorCode.AUTH_INVALID, 401)
    return fresh


def current_account(request: Request, db: Session = Depends(session), token=Depends(access_cookie)):
    csrf(request)
    if not token:
        raise SafeError(ErrorCode.AUTH_REQUIRED, 401)
    try:
        data = jwt.decode(
            token,
            settings().jwt_secret.get_secret_value(),
            algorithms=["HS256"],
            audience=AUDIENCE,
            issuer=ISSUER,
            options={"require": ["sub", "role", "iss", "aud", "iat", "exp", "jti"]},
        )
        UUID(data["sub"])
        UUID(data["jti"])
        record = db.scalar(select(AuthSession).where(AuthSession.access_jti == data["jti"]))
        account = db.get(Account, data["sub"])
        if (
            not record
            or record.revoked
            or record.expires_at <= now()
            or (
                record.remembered
                and (record.absolute_expires_at is None or record.absolute_expires_at <= now())
            )
            or record.account_id != data["sub"]
            or not account_valid(account)
            or account.role != data["role"]
        ):
            raise ValueError()
    except (jwt.PyJWTError, ValueError, TypeError):
        raise SafeError(ErrorCode.AUTH_INVALID, 401) from None
    request.state.auth_session_id = record.id
    db.info["auth_session_id"] = record.id
    return account


def require_role(*roles):
    def check(account=Depends(current_account)):
        if account.role not in roles:
            raise SafeError(ErrorCode.FORBIDDEN, 403)
        return account

    return check


def rate_limit(request, namespace):
    # Hash the network address before it enters Redis; never trust forwarded headers.
    key = f"j26:rate:{namespace}:{digest(request.client.host if request.client else 'local')}"
    try:
        count = redis_client().eval(
            "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
            1,
            key,
        )
    except Exception:
        raise SafeError(ErrorCode.DEPENDENCY_UNAVAILABLE, 503) from None
    if count > 10:
        raise SafeError(ErrorCode.RATE_LIMITED, 429)


def login(body, request, response, db):
    csrf(request)
    rate_limit(request, "login")
    account = db.scalar(select(Account).where(Account.username == body.username).with_for_update())
    # A process-local random dummy hash keeps absent-account verification comparable.
    stored = account.password_hash if account and account.password_hash else dummy_password_hash
    valid = passwords.verify(body.password, stored)
    if not valid or not account_valid(account) or account.role == Role.SERVICE:
        audit(db, request, "AUTH_FAILURE", "DENIED")
        db.commit()
        raise SafeError(ErrorCode.AUTH_INVALID, 401)
    issue(db, account, response, remembered=body.remember_me)
    audit(db, request, "AUTH_LOGIN", "SUCCESS")
    db.commit()
    return account


def refresh(request, response, db):
    csrf(request)
    rate_limit(request, "refresh")
    token = request.cookies.get("j26_refresh", "")
    record = db.scalar(select(AuthSession).where(AuthSession.refresh_hash == digest(token)))
    if not record:
        audit(db, request, "AUTH_FAILURE", "REFRESH_DENIED")
        db.commit()
        raise SafeError(ErrorCode.AUTH_INVALID, 401)
    # Account -> session ordering matches staff revocation. Refresh/login cannot issue a
    # surviving session across a completed staff disable/role change.
    account = db.scalar(
        select(Account)
        .where(Account.id == record.account_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    record = db.scalar(
        select(AuthSession)
        .where(AuthSession.id == record.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if (
        record.revoked
        or record.expires_at <= now()
        or (
            record.remembered
            and (record.absolute_expires_at is None or record.absolute_expires_at <= now())
        )
        or not account_valid(account)
    ):
        db.execute(
            update(AuthSession)
            .where(AuthSession.family_id == record.family_id)
            .values(revoked=True)
        )
        audit(db, request, "SESSION_REVOKED", "REFRESH_DENIED", once="revoke:" + record.family_id)
        db.commit()
        raise SafeError(ErrorCode.AUTH_INVALID, 401)
    record.revoked = True
    issue(
        db,
        account,
        response,
        record.family_id,
        remembered=record.remembered,
        absolute_expires_at=record.absolute_expires_at,
    )
    audit(db, request, "AUTH_REFRESH", "ROTATED")
    db.commit()
    return account


def logout(request: Request, response: Response, db):
    csrf(request)
    record = db.scalar(
        select(AuthSession).where(
            AuthSession.refresh_hash == digest(request.cookies.get("j26_refresh", ""))
        )
    )
    if record:
        db.execute(
            update(AuthSession)
            .where(AuthSession.family_id == record.family_id)
            .values(revoked=True)
        )
    for name in ("j26_access", "j26_refresh"):
        response.delete_cookie(
            name, path="/api/v1", secure=settings().cookie_secure, httponly=True, samesite="strict"
        )
    if record:
        audit(db, request, "AUTH_LOGOUT", "SUCCESS", once="logout:" + record.family_id)
    db.commit()
