from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
from services.telegram_service import send_code, verify_code, verify_2fa, check_auth_status

router = APIRouter(prefix="/auth", tags=["Authentication"])

class SendCodeRequest(BaseModel):
    phone: str

class VerifyCodeRequest(BaseModel):
    phone: str
    code: str
    phone_code_hash: str

class Verify2FARequest(BaseModel):
    phone: str
    password: str

@router.post("/send-code")
async def api_send_code(req: SendCodeRequest):
    try:
        return await send_code(req.phone)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/verify-code")
async def api_verify_code(req: VerifyCodeRequest):
    try:
        result = await verify_code(req.phone, req.code, req.phone_code_hash)
        if not result.get("success") and not result.get("requires_2fa"):
            raise HTTPException(status_code=400, detail=result.get("error", "Verification failed"))
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/2fa")
async def api_verify_2fa(req: Verify2FARequest):
    try:
        result = await verify_2fa(req.phone, req.password)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "2FA failed"))
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/status/{phone}")
async def api_auth_status(phone: str):
    try:
        return await check_auth_status(phone)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
