import logging
import time
from collections import defaultdict
from pydantic import BaseModel, field_validator
from fastapi import APIRouter, HTTPException, Depends, Request
from services.telegram_service import send_code, verify_code, verify_2fa, check_auth_status, logout_client
from services.auth_service import create_token, verify_token, blacklist_token, require_auth, require_auth_with_token
from services.utils import clean_phone

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

_rate_limits: dict = defaultdict(lambda: defaultdict(list))


def _check(key: str, max_r: int, window: float = 60.0):
    now = time.time()
    bucket = _rate_limits[key]
    bucket[key] = [t for t in bucket[key] if now - t < window]
    if len(bucket[key]) >= max_r:
        raise HTTPException(status_code=429, detail="Too many requests. Please slow down.")
    bucket[key].append(now)

class SendCodeRequest(BaseModel):
    phone: str

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = clean_phone(v)
        if len(cleaned) < 8:
            raise ValueError("Invalid phone number")
        return cleaned

class VerifyCodeRequest(BaseModel):
    phone: str
    code: str
    phone_code_hash: str

class Verify2FARequest(BaseModel):
    phone: str
    password: str


@router.post("/send-code")
async def api_send_code(request: Request, req: SendCodeRequest):
    client_ip = request.client.host if request.client else "unknown"
    _check(f"send_code:{client_ip}", 5)
    try:
        result = await send_code(req.phone)
        if result.get("message") == "Already authorized":
            token = create_token(req.phone)
            return {"token": token, "message": "Already authorized"}
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("send_code failed: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail="Failed to send code")


@router.post("/verify-code")
async def api_verify_code(request: Request, req: VerifyCodeRequest):
    client_ip = request.client.host if request.client else "unknown"
    _check(f"verify_code:{client_ip}", 10)
    try:
        phone = clean_phone(req.phone)
        result = await verify_code(phone, req.code, req.phone_code_hash)
        if result.get("success"):
            token = create_token(phone)
            return {"success": True, "token": token, "message": "Login successful"}
        if result.get("requires_2fa"):
            return {"success": False, "requires_2fa": True, "message": "2FA password required"}
        raise HTTPException(status_code=401, detail=result.get("error", "Verification failed"))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("verify_code failed: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail="Verification failed")


@router.post("/2fa")
async def api_verify_2fa(request: Request, req: Verify2FARequest):
    client_ip = request.client.host if request.client else "unknown"
    _check(f"verify_2fa:{client_ip}", 10)
    try:
        phone = clean_phone(req.phone)
        result = await verify_2fa(phone, req.password)
        if result.get("success"):
            token = create_token(phone)
            return {"success": True, "token": token, "message": "2FA login successful"}
        raise HTTPException(status_code=401, detail=result.get("error", "2FA failed"))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("2fa failed: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail="2FA verification failed")


@router.get("/status")
async def api_auth_status(phone: str = Depends(require_auth)):
    try:
        return await check_auth_status(phone)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("check_status failed: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail="Failed to check auth status")


@router.post("/logout")
async def api_logout(auth: tuple = Depends(require_auth_with_token)):
    try:
        phone, token = auth
        await logout_client(phone)
        blacklist_token(token)
        return {"success": True, "message": "Logged out"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("logout failed: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail="Logout failed")

