import os
import time
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routers import auth, groups
from services.telegram_service import disconnect_all_clients

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up...")
    yield
    logger.info("Shutting down, disconnecting all clients...")
    await disconnect_all_clients()
    logger.info("All clients disconnected.")


cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173")
parsed_origins = [o.strip() for o in cors_origins.split(",")]

app = FastAPI(title="Telegram Bulk Group Manager", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=parsed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

@app.get("/health")
async def health():
    from services.telegram_service import active_clients
    return {"status": "ok", "active_clients": len(active_clients), "uptime": time.time()}


app.include_router(auth.router)
app.include_router(groups.router)

static_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
frontend_available = os.path.isdir(static_dir)
if frontend_available:
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")


@app.middleware("http")
async def cors_preflight(request: Request, call_next):
    if request.method == "OPTIONS":
        origin = request.headers.get("origin", "")
        headers = {
            "access-control-allow-origin": origin or "*",
            "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "access-control-allow-headers": "*",
            "access-control-max-age": "86400",
        }
        if origin:
            headers["access-control-allow-credentials"] = "true"
        return Response(status_code=200, headers=headers)
    return await call_next(request)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = round((time.time() - start) * 1000)
    logger.info("%s %s -> %d (%dms)", request.method, request.url.path, response.status_code, duration)
    return response


host = os.getenv("HOST", "127.0.0.1")
port = int(os.getenv("PORT", "8000"))
if frontend_available:
    logger.info("Frontend ready at http://%s:%s", host, port)
else:
    logger.info("Frontend not built. Run 'npm run build' in frontend/ to serve UI.")
logger.info("API at http://%s:%s/health", host, port)
