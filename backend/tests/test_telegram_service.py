import pytest
from services.telegram_service import get_lock


class TestLock:
    def test_same_phone_returns_same_lock(self):
        l1 = get_lock("+1234")
        l2 = get_lock("+1234")
        assert l1 is l2

    def test_different_phones_return_different_locks(self):
        l1 = get_lock("+1111")
        l2 = get_lock("+2222")
        assert l1 is not l2

    def test_lock_is_asyncio_lock(self):
        import asyncio
        lock = get_lock("+test")
        assert isinstance(lock, asyncio.Lock)

    def test_lock_can_be_acquired(self):
        import asyncio
        lock = get_lock("+acquire_test")
        async def test():
            async with lock:
                return True
        assert asyncio.run(test())
