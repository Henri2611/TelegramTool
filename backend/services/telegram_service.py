import os
import asyncio
import json
from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError

# Dictionary to hold active clients in memory
# In a production scenario, you'd manage these more robustly
active_clients = {}

def get_client(phone: str) -> TelegramClient:
    """Get or create a Telegram client for the given phone number."""
    API_ID = os.getenv("TELEGRAM_API_ID")
    API_HASH = os.getenv("TELEGRAM_API_HASH")
    
    if not API_ID or not API_HASH:
        raise ValueError("TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in .env")
    
    if phone not in active_clients:
        session_path = f"sessions/{phone}"
        client = TelegramClient(session_path, int(API_ID), API_HASH)
        active_clients[phone] = client
    return active_clients[phone]

async def send_code(phone: str):
    client = get_client(phone)
    await client.connect()
    if not await client.is_user_authorized():
        result = await client.send_code_request(phone)
        return {"phone_code_hash": result.phone_code_hash}
    return {"message": "Already authorized"}

async def verify_code(phone: str, code: str, phone_code_hash: str):
    client = get_client(phone)
    await client.connect()
    try:
        await client.sign_in(phone=phone, code=code, phone_code_hash=phone_code_hash)
        return {"success": True, "message": "Login successful"}
    except SessionPasswordNeededError:
        return {"success": False, "requires_2fa": True, "message": "2FA password required"}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def verify_2fa(phone: str, password: str):
    client = get_client(phone)
    await client.connect()
    try:
        await client.sign_in(password=password)
        return {"success": True, "message": "2FA Login successful"}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def check_auth_status(phone: str):
    client = get_client(phone)
    await client.connect()
    is_auth = await client.is_user_authorized()
    return {"is_authorized": is_auth}

async def get_user_groups(phone: str):
    client = get_client(phone)
    await client.connect()
    if not await client.is_user_authorized():
        raise Exception("User not authorized")
    
    dialogs = await client.get_dialogs()
    groups = []
    
    for d in dialogs:
        if d.is_group or d.is_channel:
            # checking if muted
            is_muted = False
            if d.dialog.notify_settings and hasattr(d.dialog.notify_settings, 'mute_until'):
                mute_until = d.dialog.notify_settings.mute_until
                if mute_until is not None:
                    # In Telethon, mute_until can be an integer (timestamp) or datetime
                    # Often 2147483647 means muted forever
                    is_muted = True
            
            groups.append({
                "id": str(d.id),
                "title": d.title,
                "type": "channel" if d.is_channel else "group",
                "is_muted": is_muted
            })
            
    return groups

async def leave_groups_stream(phone: str, group_ids: list[str]):
    client = get_client(phone)
    await client.connect()
    if not await client.is_user_authorized():
        yield json.dumps({"status": "error", "error": "User not authorized"}) + "\n"
        return

    total = len(group_ids)
    for idx, gid_str in enumerate(group_ids):
        try:
            gid = int(gid_str)
            await client.delete_dialog(gid)
            yield json.dumps({"status": "progress", "group_id": gid_str, "index": idx + 1, "total": total}) + "\n"
        except Exception as e:
            yield json.dumps({"status": "error", "group_id": gid_str, "error": str(e)}) + "\n"
        
        # Rate limiting delay
        if idx < total - 1:
            await asyncio.sleep(2)
            
    yield json.dumps({"status": "completed"}) + "\n"

