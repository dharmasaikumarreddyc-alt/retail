"""Copy this application's SQLite data to an empty PostgreSQL database."""

import argparse
import asyncio
from pathlib import Path

from sqlalchemy import create_engine, func, select
from sqlalchemy.ext.asyncio import create_async_engine

from config import settings
from database.db import get_async_database_url
from database.models import Base


async def migrate(source_path: Path) -> None:
    if not source_path.is_file():
        raise FileNotFoundError(f"SQLite source database was not found: {source_path}")

    target_url = get_async_database_url(settings.DATABASE_URL)
    if not target_url.startswith("postgresql+asyncpg://"):
        raise ValueError("DATABASE_URL must point to PostgreSQL for this migration.")

    source_engine = create_engine(f"sqlite:///{source_path.resolve().as_posix()}")
    target_engine = create_async_engine(target_url)
    copied_rows: dict[str, int] = {}

    try:
        with source_engine.connect() as source:
            source_tables = set(source.dialect.get_table_names(source))
            tables = [table for table in Base.metadata.sorted_tables if table.name in source_tables]
            if not tables:
                raise ValueError("The SQLite database does not contain any recognized application tables.")
            source_counts = {
                table.name: source.scalar(select(func.count()).select_from(table))
                for table in tables
            }

            async with target_engine.begin() as target:
                await target.run_sync(Base.metadata.create_all)
                for table in tables:
                    count = await target.scalar(select(func.count()).select_from(table))
                    if count:
                        raise ValueError(
                            f"Target table {table.name!r} is not empty; refusing to risk duplicate data."
                        )

                for table in tables:
                    result = source.execute(select(table))
                    copied_rows[table.name] = 0
                    while batch := result.mappings().fetchmany(500):
                        await target.execute(table.insert(), [dict(row) for row in batch])
                        copied_rows[table.name] += len(batch)

                for table in tables:
                    actual_count = await target.scalar(select(func.count()).select_from(table))
                    expected_count = source_counts[table.name]
                    if actual_count != expected_count:
                        raise RuntimeError(
                            f"Row-count verification failed for {table.name!r}: "
                            f"expected {expected_count}, got {actual_count}."
                        )
    finally:
        source_engine.dispose()
        await target_engine.dispose()

    total = sum(copied_rows.values())
    print(f"Migration completed: {total} rows copied across {len(copied_rows)} tables.")
    for table_name, count in copied_rows.items():
        print(f"  {table_name}: {count}")
    print("The SQLite source was left unchanged.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=Path(__file__).resolve().parent / "aisle.db",
        help="Path to the existing SQLite database (default: backend/aisle.db).",
    )
    args = parser.parse_args()
    asyncio.run(migrate(args.source))


if __name__ == "__main__":
    main()
