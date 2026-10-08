import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.v1.api import api_router
from app.db import base  # Ensure all models are registered


app = FastAPI(
    title="Food Ordering API",
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/openapi.json"
)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local development
    allow_credentials=True,
    allow_methods=["*"],  # Allows GET, POST, OPTIONS, etc.
    allow_headers=["*"],
)

# Mount static files for uploads
static_dir = os.getenv("STATIC_DIR", "/tmp/static" if os.getenv("AWS_LAMBDA_FUNCTION_NAME") else "static")
os.makedirs(os.path.join(static_dir, "uploads"), exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# All routes now start with /api/v1
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
@app.get("/api/v1")
@app.get("/api/v1/")
async def root():
    return {"message": "Mingalaba! Food API is running"}
