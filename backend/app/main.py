from fastapi import FastAPI
from app.api.v1.api import api_router
from app.db import base  # Ensure all models are registered


app = FastAPI(title="Food Ordering API")

# All routes now start with /api/v1
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "Mingalaba! Food API is running"}
