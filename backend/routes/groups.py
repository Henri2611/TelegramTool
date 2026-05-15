from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.telegram_service import get_user_groups, leave_groups_stream

router = APIRouter(prefix="/groups", tags=["Groups"])

class LeaveGroupsRequest(BaseModel):
    group_ids: list[str]

@router.get("/{phone}")
async def api_get_groups(phone: str):
    try:
        groups = await get_user_groups(phone)
        return {"success": True, "data": groups}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{phone}/leave")
async def api_leave_groups(phone: str, req: LeaveGroupsRequest):
    return StreamingResponse(
        leave_groups_stream(phone, req.group_ids), 
        media_type="application/x-ndjson"
    )
