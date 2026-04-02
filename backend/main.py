import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import portal, warehouse, admin

app = FastAPI(title="Shop Admin API")

# FRONTEND_URL is set in Railway env vars to your Vercel URL.
# Falls back to localhost for local dev.
_frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
_origins = list({_frontend_url, "http://localhost:5173"})

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(portal.router,    prefix="/api/portal")
app.include_router(warehouse.router, prefix="/api/warehouse")
app.include_router(admin.router,     prefix="/api/admin")


@app.get("/api/health")
def health():
    return {"status": "ok"}
