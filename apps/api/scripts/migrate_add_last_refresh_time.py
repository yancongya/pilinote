"""
Database migration script - Add last_refresh_time field to users table

Adds the following field to users table:
- last_refresh_time (DateTime) - 上次刷新时间
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from src.database import engine


def migrate():
    """Migrate database to add last_refresh_time field"""
    print("🚀 Starting database migration: Add last_refresh_time to users table\n")

    with engine.connect() as conn:
        existing_columns = []
        result = conn.execute(text("PRAGMA table_info(users)"))
        for row in result:
            existing_columns.append(row[1])

        column_name = "last_refresh_time"
        if column_name not in existing_columns:
            try:
                sql = f"ALTER TABLE users ADD COLUMN {column_name} DATETIME"
                conn.execute(text(sql))
                conn.commit()
                print(f"✅ Added column: {column_name} (DATETIME)")
            except Exception as e:
                print(f"❌ Failed to add column {column_name}: {e}")
        else:
            print(f"⏭️  Column {column_name} already exists, skipping")

    print("\n✅ Database migration completed!")


if __name__ == "__main__":
    migrate()
