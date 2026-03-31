from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import portal, warehouse, admin

app = FastAPI(title="Shop Admin API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(portal.router,    prefix="/api/portal")
app.include_router(warehouse.router, prefix="/api/warehouse")
app.include_router(admin.router,     prefix="/api/admin")


@app.get("/api/health")
def health():
    return {"status": "ok"}
