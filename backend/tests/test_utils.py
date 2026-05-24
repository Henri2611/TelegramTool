import pytest
from services.utils import clean_phone


class TestCleanPhone:
    def test_international_format(self):
        assert clean_phone("+254 712 345 678") == "+254712345678"

    def test_local_format(self):
        assert clean_phone("0712345678") == "+712345678"

    def test_with_brackets_and_dashes(self):
        assert clean_phone("+1 (234) 567-8900") == "+12345678900"

    def test_already_clean(self):
        assert clean_phone("+1234567890") == "+1234567890"

    def test_missing_plus(self):
        assert clean_phone("1234567890") == "+1234567890"

    def test_empty_string(self):
        assert clean_phone("") == "+"

    def test_alpha_chars_removed(self):
        assert clean_phone("+1 (ABC) 234") == "+1234"

    def test_multiple_plus_signs(self):
        assert clean_phone("+++1234") == "+1234"
