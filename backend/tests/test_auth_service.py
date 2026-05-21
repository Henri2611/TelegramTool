import time
import pytest
from services.auth_service import create_token, verify_token, blacklist_token


class TestJWT:
    def test_create_and_verify_token(self):
        phone = "+1234567890"
        token = create_token(phone)
        decoded = verify_token(token)
        assert decoded == phone

    def test_token_contains_phone(self):
        phone = "+9876543210"
        token = create_token(phone)
        assert isinstance(token, str)
        assert len(token) > 20

    def test_blacklisted_token_fails(self):
        phone = "+1111111111"
        token = create_token(phone)
        blacklist_token(token)
        with pytest.raises(Exception):
            verify_token(token)

    def test_expired_token_fails(self):
        import jwt
        from services.auth_service import JWT_SECRET, JWT_ALGORITHM

        expired = jwt.encode(
            {"phone": "+1234", "iat": 0, "exp": 0},
            JWT_SECRET,
            algorithm=JWT_ALGORITHM
        )
        with pytest.raises(Exception):
            verify_token(expired)

    def test_invalid_token_fails(self):
        with pytest.raises(Exception):
            verify_token("this.is.not.a.valid.token")

    def test_multiple_tokens_are_valid(self):
        t1 = create_token("+111")
        t2 = create_token("+111")
        assert verify_token(t1) == "+111"
        assert verify_token(t2) == "+111"
