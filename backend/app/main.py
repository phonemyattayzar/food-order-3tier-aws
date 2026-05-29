from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.api import api_router
from app.db import base  # Ensure all models are registered


app = FastAPI(title="Food Ordering API")

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local development
    allow_credentials=True,
    allow_methods=["*"],  # Allows GET, POST, OPTIONS, etc.
    allow_headers=["*"],
)

# All routes now start with /api/v1
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "Mingalaba! Food API is running"}
