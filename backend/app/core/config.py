import json
import os

import boto3
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str | None = None
    POSTGRES_USER: str | None = None
    POSTGRES_PASSWORD: str | None = None
    POSTGRES_DB: str | None = None
    SECRET_KEY: str | None = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 11520
    SUPPORT_TICKETS_ENABLED: bool = False


settings = Settings()
secret_arn = os.getenv("DB_SECRET_ARN")
if secret_arn:
    response = boto3.client("secretsmanager").get_secret_value(SecretId=secret_arn)
    db_secret = json.loads(response["SecretString"])
    settings.DATABASE_URL = URL.create(
        drivername="postgresql+psycopg2",
        username=db_secret["username"],
        password=db_secret["password"],
        host=db_secret["host"],
        port=int(db_secret["port"]),
        database=db_secret["database"],
        query={"sslmode": "require"},
    ).render_as_string(hide_password=False)
    settings.SECRET_KEY = db_secret["secret_key"]

if not settings.DATABASE_URL and settings.POSTGRES_USER and settings.POSTGRES_PASSWORD and settings.POSTGRES_DB:
    settings.DATABASE_URL = URL.create(
        drivername="postgresql+psycopg2",
        username=settings.POSTGRES_USER,
        password=settings.POSTGRES_PASSWORD,
        host="localhost",
        port=5432,
        database=settings.POSTGRES_DB,
    ).render_as_string(hide_password=False)

if not settings.DATABASE_URL:
    raise ValueError("DATABASE_URL or DB_SECRET_ARN must be configured")
if not settings.SECRET_KEY:
    raise ValueError("SECRET_KEY must be configured locally or supplied by Secrets Manager")
