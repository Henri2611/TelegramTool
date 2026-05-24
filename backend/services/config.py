import os


class Settings:
    telegram_api_id: str
    telegram_api_hash: str
    jwt_secret: str
    cors_origins: list[str]
    host: str
    port: int

    def __init__(self):
        self.telegram_api_id = os.getenv("TELEGRAM_API_ID", "")
        self.telegram_api_hash = os.getenv("TELEGRAM_API_HASH", "")
        self.jwt_secret = os.getenv("JWT_SECRET", "")
        cors_raw = os.getenv("CORS_ORIGINS", "*")
        self.cors_origins = [o.strip() for o in cors_raw.split(",")]
        self.host = os.getenv("HOST", "127.0.0.1")
        self.port = int(os.getenv("PORT", "8000"))

    def validate(self):
        missing = []
        if not self.telegram_api_id:
            missing.append("TELEGRAM_API_ID")
        if not self.telegram_api_hash:
            missing.append("TELEGRAM_API_HASH")
        if not self.jwt_secret:
            missing.append("JWT_SECRET")
        if missing:
            raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}. Set them in backend/.env")


settings = Settings()
