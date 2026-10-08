import sys
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# -----------------------------
# Fix Python path for imports
# -----------------------------
sys.path.append(
    os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
)

# -----------------------------
# Alembic Config
# -----------------------------
config = context.config

# Logging config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# -----------------------------
# IMPORT YOUR APP CODE
# -----------------------------
from app.db.base import Base
from app.core.config import settings

# IMPORTANT: this tells Alembic what to track
target_metadata = Base.metadata

# -----------------------------
# Set DB URL dynamically (from .env)
# -----------------------------
config.set_main_option(
    "sqlalchemy.url",
    settings.DATABASE_URL.replace("%", "%%")
)

# -----------------------------
# OFFLINE MODE
# -----------------------------
def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
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
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
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