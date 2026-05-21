import os
import asyncio
import json
import time
import logging
import socks
from datetime import datetime, timezone
from telethon import TelegramClient, functions, types
from telethon.errors import SessionPasswordNeededError, FloodWaitError

logger = logging.getLogger(__name__)

_SESSION_DIR = os.path.join(os.path.dirname(__file__), "..", "sessions")
os.makedirs(_SESSION_DIR, exist_ok=True)

active_clients: dict[str, TelegramClient] = {}
client_locks: dict[str, asyncio.Lock] = {}
clients_lock = asyncio.Lock()


def _get_proxy():
    proxy_type = os.getenv("TELEGRAM_PROXY_TYPE")
    if not proxy_type:
        return None
    host = os.getenv("TELEGRAM_PROXY_HOST", "127.0.0.1")
    port = int(os.getenv("TELEGRAM_PROXY_PORT", "9050"))
    username = os.getenv("TELEGRAM_PROXY_USERNAME")
    password = os.getenv("TELEGRAM_PROXY_PASSWORD")

    proxy_map = {
        "SOCKS5": socks.SOCKS5,
        "SOCKS4": socks.SOCKS4,
        "HTTP": socks.HTTP,
    }
    proto = proxy_map.get(proxy_type.upper())
    if proto is None:
        raise ValueError(f"Unsupported proxy type: {proxy_type}. Use SOCKS5, SOCKS4, or HTTP.")

    if username and password:
        return (proto, host, port, True, username, password)
    return (proto, host, port)


def get_lock(phone: str) -> asyncio.Lock:
    if phone not in client_locks:
        client_locks[phone] = asyncio.Lock()
    return client_locks[phone]


async def get_client(phone: str) -> TelegramClient:
    API_ID = os.getenv("TELEGRAM_API_ID")
    API_HASH = os.getenv("TELEGRAM_API_HASH")

    if not API_ID or not API_HASH:
        raise ValueError("TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in .env")

    async with clients_lock:
        if phone not in active_clients:
            session_path = os.path.join(_SESSION_DIR, phone)
            client = TelegramClient(
                session_path,
                int(API_ID),
                API_HASH,
                proxy=_get_proxy(),
                system_version="4.16.30-vxCUSTOM"
            )
            active_clients[phone] = client
            logger.info("Created new TelegramClient for %s", phone)
        return active_clients[phone]


async def disconnect_client(phone: str):
    async with get_lock(phone):
        if phone in active_clients:
            client = active_clients[phone]
            await client.disconnect()
            async with clients_lock:
                del active_clients[phone]
        if phone in client_locks:
            del client_locks[phone]
    logger.info("Disconnected client for %s", phone)
    return {"success": True, "message": "Client disconnected"}


async def logout_client(phone: str):
    async with get_lock(phone):
        client = await get_client(phone)
        await client.connect()
        try:
            await client.log_out()
            logger.info("Logged out from Telegram for %s", phone)
        except Exception as e:
            logger.error("Telegram log_out failed for %s: %s", phone, e)
        await client.disconnect()
        async with clients_lock:
            if phone in active_clients:
                del active_clients[phone]
        if phone in client_locks:
            del client_locks[phone]
    session_path = os.path.join(_SESSION_DIR, phone)
    for suffix in (".session", ".session-journal"):
        path = session_path + suffix
        if os.path.exists(path):
            os.remove(path)
            logger.info("Deleted session file %s", path)
    return {"success": True, "message": "Logged out and session cleared"}


async def disconnect_all_clients():
    async with clients_lock:
        phones = list(active_clients.keys())
    for phone in phones:
        try:
            await disconnect_client(phone)
        except Exception as e:
            logger.error("Error disconnecting %s: %s", phone, e)


async def send_code(phone: str):
    async with get_lock(phone):
        client = await get_client(phone)
        await client.connect()
        if not await client.is_user_authorized():
            result = await client.send_code_request(phone)
            logger.info("Sent code to %s", phone)
            return {"phone_code_hash": result.phone_code_hash}
        logger.info("Phone %s already authorized", phone)
        return {"message": "Already authorized"}


async def verify_code(phone: str, code: str, phone_code_hash: str):
    async with get_lock(phone):
        client = await get_client(phone)
        await client.connect()
        try:
            await client.sign_in(phone=phone, code=code, phone_code_hash=phone_code_hash)
            logger.info("Login successful for %s", phone)
            return {"success": True, "message": "Login successful"}
        except SessionPasswordNeededError:
            logger.info("2FA required for %s", phone)
            return {"success": False, "requires_2fa": True, "message": "2FA password required"}
        except Exception as e:
            logger.error("Verify code failed for %s: %s", phone, e)
            return {"success": False, "error": str(e)}


async def verify_2fa(phone: str, password: str):
    async with get_lock(phone):
        client = await get_client(phone)
        await client.connect()
        try:
            await client.sign_in(password=password)
            logger.info("2FA login successful for %s", phone)
            return {"success": True, "message": "2FA Login successful"}
        except Exception as e:
            logger.error("2FA failed for %s: %s", phone, e)
            return {"success": False, "error": str(e)}


async def check_auth_status(phone: str):
    async with get_lock(phone):
        client = await get_client(phone)
        await client.connect()
        is_auth = await client.is_user_authorized()
        return {"is_authorized": is_auth}


async def get_user_groups(phone: str):
    async with get_lock(phone):
        client = await get_client(phone)
        await client.connect()
        if not await client.is_user_authorized():
            raise Exception("User not authorized")

        dialogs = await client.get_dialogs()
        groups = []
        now = datetime.now(timezone.utc)

        group_dialogs = [d for d in dialogs if d.is_group or d.is_channel]

        fresh_settings: dict[int, types.PeerNotifySettings] = {}
        if group_dialogs:
            try:
                peers = [d.entity for d in group_dialogs if d.entity]
                if peers:
                    result = await client(functions.messages.GetPeerDialogsRequest(peers=peers))
                    for fd in result.dialogs:
                        peer = fd.peer
                        if isinstance(peer, types.PeerChannel):
                            fresh_settings[peer.channel_id] = fd.notify_settings
                        elif isinstance(peer, types.PeerChat):
                            fresh_settings[peer.chat_id] = fd.notify_settings
            except Exception as e:
                logger.warning("Failed to refresh notify settings: %s", e)

        for d in group_dialogs:
            ns = fresh_settings.get(d.id, d.dialog.notify_settings)
            is_muted = False
            if ns is not None:
                mute_until = getattr(ns, 'mute_until', None)
                if mute_until is not None:
                    if isinstance(mute_until, datetime):
                        is_muted = mute_until > now
                    else:
                        is_muted = mute_until > datetime.timestamp(now)

            member_count = None
            try:
                if hasattr(d, 'entity') and d.entity:
                    member_count = getattr(d.entity, 'participants_count', None) or getattr(d.entity, 'users_count', None)
            except Exception:
                pass

            groups.append({
                "id": str(d.id),
                "title": d.title,
                "type": "channel" if d.is_channel else "group",
                "is_muted": is_muted,
                "member_count": member_count,
            })

        logger.info("Fetched %d groups for %s", len(groups), phone)
        return groups


async def leave_groups_stream(phone: str, group_ids: list[str]):
    async with get_lock(phone):
        client = await get_client(phone)
        await client.connect()
        if not await client.is_user_authorized():
            yield json.dumps({"status": "error", "error": "User not authorized"}) + "\n"
            return

        total = len(group_ids)
        for idx, gid_str in enumerate(group_ids):
            try:
                gid = int(gid_str)
                try:
                    await client.delete_dialog(gid)
                    yield json.dumps({"status": "progress", "group_id": gid_str, "index": idx + 1, "total": total}) + "\n"
                except FloodWaitError as fwe:
                    wait = fwe.seconds
                    logger.warning("FloodWait for %s: waiting %ds", phone, wait)
                    yield json.dumps({"status": "flood_wait", "group_id": gid_str, "wait_seconds": wait}) + "\n"
                    await asyncio.sleep(min(wait, 60))
                    try:
                        await client.delete_dialog(gid)
                        yield json.dumps({"status": "progress", "group_id": gid_str, "index": idx + 1, "total": total}) + "\n"
                    except Exception as e2:
                        yield json.dumps({"status": "error", "group_id": gid_str, "error": str(e2)}) + "\n"
            except Exception as e:
                logger.error("Failed to leave group %s for %s: %s", gid_str, phone, e)
                yield json.dumps({"status": "error", "group_id": gid_str, "error": str(e)}) + "\n"

            if idx < total - 1:
                await asyncio.sleep(2)

    logger.info("Completed leave for %s (%d groups)", phone, total)
    yield json.dumps({"status": "completed"}) + "\n"
