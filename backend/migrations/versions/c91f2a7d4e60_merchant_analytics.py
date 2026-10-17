"""Add merchant accounts, sales analytics, and customer reviews.

Revision ID: c91f2a7d4e60
Revises: 43c5b75f3a68
Create Date: 2026-10-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c91f2a7d4e60"
down_revision: Union[str, None] = "43c5b75f3a68"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "merchant_profiles",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("address", sa.String(), nullable=False),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("is_demo", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "merchant_accounts",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("merchant_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchant_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("merchant_id", name="uq_merchant_accounts_merchant_id"),
        sa.UniqueConstraint("user_id", name="uq_merchant_accounts_user_id"),
    )
    op.create_table(
        "merchant_orders",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("merchant_id", sa.String(), nullable=False),
        sa.Column("items", sa.JSON(), nullable=False),
        sa.Column("total", sa.Float(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("dispatched_at", sa.DateTime(), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(), nullable=True),
        sa.Column("cancellation_reason", sa.Text(), nullable=True),
        sa.Column("is_demo", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchant_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_merchant_orders_merchant_id", "merchant_orders", ["merchant_id"])
    op.create_index("ix_merchant_orders_status", "merchant_orders", ["status"])
    op.create_index("ix_merchant_orders_created_at", "merchant_orders", ["created_at"])
    op.create_index("ix_merchant_orders_is_demo", "merchant_orders", ["is_demo"])
    op.create_table(
        "merchant_reviews",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("merchant_id", sa.String(), nullable=False),
        sa.Column("order_id", sa.String(), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("review", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("is_demo", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchant_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["order_id"], ["merchant_orders.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_merchant_reviews_merchant_id", "merchant_reviews", ["merchant_id"])
    op.create_index("ix_merchant_reviews_created_at", "merchant_reviews", ["created_at"])
    op.create_index("ix_merchant_reviews_is_demo", "merchant_reviews", ["is_demo"])


def downgrade() -> None:
    op.drop_index("ix_merchant_reviews_is_demo", table_name="merchant_reviews")
    op.drop_index("ix_merchant_reviews_created_at", table_name="merchant_reviews")
    op.drop_index("ix_merchant_reviews_merchant_id", table_name="merchant_reviews")
    op.drop_table("merchant_reviews")
    op.drop_index("ix_merchant_orders_is_demo", table_name="merchant_orders")
    op.drop_index("ix_merchant_orders_created_at", table_name="merchant_orders")
    op.drop_index("ix_merchant_orders_status", table_name="merchant_orders")
    op.drop_index("ix_merchant_orders_merchant_id", table_name="merchant_orders")
    op.drop_table("merchant_orders")
    op.drop_table("merchant_accounts")
    op.drop_table("merchant_profiles")
