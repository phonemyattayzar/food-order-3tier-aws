from mangum import Mangum

from app.main import app

# API Gateway HTTP API payload format 2.0 adapter for FastAPI.
handler = Mangum(app, lifespan="off")
