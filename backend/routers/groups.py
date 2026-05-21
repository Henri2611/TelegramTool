import logging
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
from services.telegram_service import get_user_groups, leave_groups_stream
from services.auth_service import require_auth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/groups", tags=["Groups"])


class LeaveGroupsRequest(BaseModel):
    group_ids: list[str]

    @field_validator("group_ids")
    @classmethod
    def validate_group_ids(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("group_ids must not be empty")
        if len(v) > 500:
            raise ValueError("group_ids must not exceed 500 items")
        if len(v) != len(set(v)):
            raise ValueError("group_ids must not contain duplicates")
        for gid in v:
            try:
                int(gid)
            except ValueError:
                raise ValueError(f"Invalid group_id: {gid}")
        return v


@router.get("")
async def api_get_groups(phone: str = Depends(require_auth)):
    try:
        groups = await get_user_groups(phone)
        return {"success": True, "data": groups}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_groups failed: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail="Failed to fetch groups")


@router.post("/leave")
async def api_leave_groups(req: LeaveGroupsRequest, phone: str = Depends(require_auth)):
    try:
        return StreamingResponse(
            leave_groups_stream(phone, req.group_ids),
            media_type="application/x-ndjson"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("leave_groups failed: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail="Failed to start leave operation")
