from datetime import timedelta
from uuid import UUID, uuid4

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPBearer
from research_contracts import ErrorCode, now

from research_common.config import settings
from research_common.web import SafeError, redis_client

SERVICE_SUB = "a227d901-4b0b-442f-ac89-350fe36d28d1"  # Synthetic system identifier, not a secret.


def service_token(name):
    token_id = str(uuid4())
    redis_client().set(f"j26:service-token:{name}:{token_id}", "active", ex=60)
    return jwt.encode(
        {
            "sub": SERVICE_SUB,
            "role": "SERVICE",
            "iss": "j26-worker",
            "aud": name,
            "iat": now(),
            "exp": now() + timedelta(seconds=60),
            "jti": token_id,
        },
        getattr(settings(), name + "_secret").get_secret_value(),
        algorithm="HS256",
    )


def service_auth(name):
    bearer = HTTPBearer(auto_error=False)

    def check(request: Request, credentials=Depends(bearer)):
        try:
            header = request.headers.get("authorization", "")
            if not header.startswith("Bearer "):
                raise ValueError()
            data = jwt.decode(
                header[7:],
                getattr(settings(), name + "_secret").get_secret_value(),
                algorithms=["HS256"],
                audience=name,
                issuer="j26-worker",
                options={"require": ["sub", "role", "iss", "aud", "iat", "exp", "jti"]},
            )
            UUID(data["jti"])
            if data["sub"] != SERVICE_SUB or data["role"] != "SERVICE":
                raise ValueError()
            cache = redis_client()
            if (
                cache.get(f"j26:service-disabled:{name}")
                or cache.get(f"j26:service-token:{name}:{data['jti']}") != "active"
            ):
                raise ValueError()
        except (jwt.PyJWTError, ValueError, TypeError):
            raise SafeError(ErrorCode.AUTH_INVALID, 401) from None
        except Exception:
            raise SafeError(ErrorCode.DEPENDENCY_UNAVAILABLE, 503) from None

    return check
