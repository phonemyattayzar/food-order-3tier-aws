"""add favorite customizations

Revision ID: e7b1c4a9d2f0
Revises: d2a6f4b8c931
Create Date: 2026-11-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e7b1c4a9d2f0"
down_revision: Union[str, Sequence[str], None] = "d2a6f4b8c931"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("customization_note", sa.Text(), nullable=True))

    op.create_table(
        "favorite_customizations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("restaurant_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("customization_note", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["restaurant_id"], ["restaurants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "restaurant_id",
            "name",
            name="uq_favorite_user_restaurant_name",
        ),
    )
    op.create_index(
        "ix_favorite_customizations_user_restaurant",
        "favorite_customizations",
        ["user_id", "restaurant_id"],
        unique=False,
    )

    op.create_table(
        "favorite_customization_items",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("favorite_id", sa.UUID(), nullable=False),
        sa.Column("menu_item_id", sa.UUID(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["favorite_id"], ["favorite_customizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["menu_item_id"], ["menu_items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_favorite_customization_items_favorite_id",
        "favorite_customization_items",
        ["favorite_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_favorite_customization_items_favorite_id",
        table_name="favorite_customization_items",
    )
    op.drop_table("favorite_customization_items")
    op.drop_index(
        "ix_favorite_customizations_user_restaurant",
        table_name="favorite_customizations",
    )
    op.drop_table("favorite_customizations")
    op.drop_column("orders", "customization_note")
