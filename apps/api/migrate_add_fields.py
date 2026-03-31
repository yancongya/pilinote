"""
Database migration script - Add new fields to downloads table

Adds the following fields to downloads table:
- enable_nfo (Integer)
- enable_subtitle (Integer)
- enable_danmaku (Integer)
- danmaku_format (String)
- enable_cover (Integer)
- enable_avatar (Integer)
- block_pcdn (Integer)
"""
import sys
import os

# Add project root directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from src.database import engine


def migrate():
    """Migrate database to add new fields"""
    print("🚀 Starting database migration: Add new fields to downloads table\n")

    with engine.connect() as conn:
        # Check if columns already exist
        columns_to_add = [
            ("enable_nfo", "INTEGER DEFAULT 1"),
            ("enable_subtitle", "INTEGER DEFAULT 1"),
            ("enable_danmaku", "INTEGER DEFAULT 0"),
            ("danmaku_format", "VARCHAR(10) DEFAULT 'xml'"),
            ("enable_cover", "INTEGER DEFAULT 1"),
            ("enable_avatar", "INTEGER DEFAULT 0"),
            ("block_pcdn", "INTEGER DEFAULT 1"),
        ]

        existing_columns = []
        result = conn.execute(text("PRAGMA table_info(downloads)"))
        for row in result:
            existing_columns.append(row[1])  # Column name is at index 1

        # Add missing columns
        for column_name, column_type in columns_to_add:
            if column_name not in existing_columns:
                try:
                    sql = f"ALTER TABLE downloads ADD COLUMN {column_name} {column_type}"
                    conn.execute(text(sql))
                    conn.commit()
                    print(f"✅ Added column: {column_name} ({column_type})")
                except Exception as e:
                    print(f"❌ Failed to add column {column_name}: {e}")
            else:
                print(f"⏭️  Column {column_name} already exists, skipping")

    print("\n✅ Database migration completed!")


if __name__ == "__main__":
    migrate()