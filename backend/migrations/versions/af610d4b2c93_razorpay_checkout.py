"""Add persistent Razorpay payment intents.

Revision ID: af610d4b2c93
Revises: c91f2a7d4e60
Create Date: 2026-10-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "af610d4b2c93"
down_revision: Union[str, None] = "c91f2a7d4e60"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table("payment_intents"):
        columns = {column["name"] for column in inspector.get_columns("payment_intents")}
        required_columns = {
            "id",
            "user_id",
            "merchant_id",
            "provider_order_id",
            "provider_payment_id",
            "items",
            "pricing",
            "delivery_address",
            "requested_method",
            "status",
            "created_at",
        }
        unique_constraints = inspector.get_unique_constraints("payment_intents")
        indexes = inspector.get_indexes("payment_intents")
        unique_columns = {
            column
            for constraint in unique_constraints
            for column in constraint["column_names"]
        }
        unique_columns.update(
            column
            for index in indexes
            if index["unique"]
            for column in index["column_names"]
        )
        if (
            not required_columns.issubset(columns)
            or not {"provider_order_id", "provider_payment_id"}.issubset(unique_columns)
        ):
            raise RuntimeError(
                "Existing payment_intents table is incomplete; refusing to mark the checkout migration applied."
            )
        return

    op.create_table(
        "payment_intents",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("merchant_id", sa.String(), nullable=False),
        sa.Column("provider_order_id", sa.String(), nullable=False),
        sa.Column("provider_payment_id", sa.String(), nullable=True),
        sa.Column("items", sa.JSON(), nullable=False),
        sa.Column("pricing", sa.JSON(), nullable=False),
        sa.Column("delivery_address", sa.Text(), nullable=False),
        sa.Column("requested_method", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchant_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider_order_id"),
        sa.UniqueConstraint("provider_payment_id"),
    )
    op.create_index("ix_payment_intents_user_id", "payment_intents", ["user_id"])
    op.create_index("ix_payment_intents_merchant_id", "payment_intents", ["merchant_id"])
    op.create_index("ix_payment_intents_status", "payment_intents", ["status"])


def downgrade() -> None:
    op.drop_index("ix_payment_intents_status", table_name="payment_intents")
    op.drop_index("ix_payment_intents_merchant_id", table_name="payment_intents")
    op.drop_index("ix_payment_intents_user_id", table_name="payment_intents")
    op.drop_table("payment_intents")
