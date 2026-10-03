import os
import sys
from logging.config import fileConfig

from alembic import context

# -----------------------------
# Fix Python path for imports
# -----------------------------
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# -----------------------------
# IMPORT YOUR APP CODE
# -----------------------------
from app.core.config import settings  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402

# -----------------------------
# Alembic Config
# -----------------------------
config = context.config

# Logging config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# IMPORTANT: this tells Alembic what to track
target_metadata = Base.metadata


# -----------------------------
# OFFLINE MODE
# -----------------------------
def run_migrations_offline() -> None:
    if not settings.DATABASE_URL:
        raise ValueError("DATABASE_URL is not configured for migrations")

    context.configure(
        url=settings.DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


# -----------------------------
# ONLINE MODE
# -----------------------------
def run_migrations_online() -> None:
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


# -----------------------------
# RUN MODE SWITCH
# -----------------------------
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()