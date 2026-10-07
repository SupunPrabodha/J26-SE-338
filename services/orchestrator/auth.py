import hashlib
import secrets
from datetime import timedelta
from uuid import UUID, uuid4

import jwt
from fastapi import Depends, Request, Response
from fastapi.security import APIKeyCookie
from pwdlib import PasswordHash
from research_common.config import settings
from research_common.database import Account, Audit, AuthSession, session
from research_common.web import SafeError, redis_client
from research_contracts import AuditEvent, ErrorCode, Role, now
from sqlalchemy import select, update
from sqlalchemy.orm import Session

passwords = PasswordHash.recommended()
dummy_password_hash = passwords.hash(secrets.token_urlsafe(32))
ISSUER = "j26-development-identity"
AUDIENCE = "j26-orchestrator"
access_cookie = APIKeyCookie(name="j26_access", auto_error=False)


def audit(db, request, event, status, case_id=None):
    item = AuditEvent(
        case_id=case_id,
        correlation_id=request.state.correlation_id,
        event_type=event,
        status=status,
    )
    db.add(
        Audit(
            id=str(item.event_id),
            case_id=str(case_id) if case_id else None,
            correlation_id=str(item.correlation_id),
            event_type=item.event_type,
            status=item.status,
            created_at=item.created_at,
        )
    )


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


def issue(db, account, response, family=None):
    access_jti, refresh = str(uuid4()), secrets.token_urlsafe(48)
    expires = (
        min(now() + timedelta(seconds=settings().refresh_seconds), account.expires_at)
        if account.expires_at
        else now() + timedelta(seconds=settings().refresh_seconds)
    )
    db.add(
        AuthSession(
            account_id=account.id,
            access_jti=access_jti,
            refresh_hash=digest(refresh),
            family_id=family or str(uuid4()),
            expires_at=expires,
        )
    )
    access = jwt.encode(
        claims(account, access_jti), settings().jwt_secret.get_secret_value(), algorithm="HS256"
    )
    for name, value, age in [
        ("j26_access", access, settings().access_seconds),
        ("j26_refresh", refresh, settings().refresh_seconds),
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
            or record.account_id != data["sub"]
            or not account_valid(account)
            or account.role != data["role"]
        ):
            raise ValueError()
    except (jwt.PyJWTError, ValueError, TypeError):
        raise SafeError(ErrorCode.AUTH_INVALID, 401) from None
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
    account = db.scalar(select(Account).where(Account.username == body.username))
    # A process-local random dummy hash keeps absent-account verification comparable.
    stored = account.password_hash if account and account.password_hash else dummy_password_hash
    valid = passwords.verify(body.password, stored)
    if not valid or not account_valid(account) or account.role == Role.SERVICE:
        audit(db, request, "AUTH_FAILURE", "DENIED")
        db.commit()
        raise SafeError(ErrorCode.AUTH_INVALID, 401)
    issue(db, account, response)
    audit(db, request, "AUTH_LOGIN", "SUCCESS")
    db.commit()
    return account


def refresh(request, response, db):
    csrf(request)
    rate_limit(request, "refresh")
    token = request.cookies.get("j26_refresh", "")
    record = db.scalar(
        select(AuthSession).where(AuthSession.refresh_hash == digest(token)).with_for_update()
    )
    if not record:
        raise SafeError(ErrorCode.AUTH_INVALID, 401)
    account = db.get(Account, record.account_id)
    if record.revoked or record.expires_at <= now() or not account_valid(account):
        db.execute(
            update(AuthSession)
            .where(AuthSession.family_id == record.family_id)
            .values(revoked=True)
        )
        db.commit()
        raise SafeError(ErrorCode.AUTH_INVALID, 401)
    record.revoked = True
    issue(db, account, response, record.family_id)
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
    audit(db, request, "AUTH_LOGOUT", "SUCCESS")
    db.commit()
