from alembic import command
from alembic.config import Config


def handler(event, context):
    config = Config("/var/task/alembic.ini")
    # Keep project revisions separate from the installed Alembic package.
    config.set_main_option("script_location", "/var/task/migrations")
    command.upgrade(config, "head")
    return {"status": "migrations applied"}
