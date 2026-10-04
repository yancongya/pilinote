"""
Add new fields to downloads table

Phase 1: Data Model Refactoring
"""
import sys
from pathlib import Path

# Add apps/api to path
sys.path.insert(0, str(Path(__file__).parent))

from src.database import engine, SessionLocal
from sqlalchemy import text


def migrate():
    """Add new fields to downloads table"""
    print("=" * 60)
    print("Adding new fields to downloads table")
    print("=" * 60)

    db = SessionLocal()
    try:
        # Check existing columns
        existing_columns = [col[1] for col in db.execute(text('PRAGMA table_info(downloads)')).fetchall()]
        print(f"\nExisting columns: {', '.join(existing_columns)}")

        # New fields to add
        new_fields = {
            'media_type': 'VARCHAR(20)',
            'source_type': 'VARCHAR(20)',
            'source_id': 'VARCHAR(50)',
            'task_id': 'VARCHAR(50)'
        }

        # Add new fields
        for field_name, field_type in new_fields.items():
            if field_name not in existing_columns:
                print(f"\nAdding field: {field_name} ({field_type})")
                db.execute(text(f'ALTER TABLE downloads ADD COLUMN {field_name} {field_type}'))
                print(f"  Successfully added {field_name}")
            else:
                print(f"\nSkipping {field_name} (already exists)")

        db.commit()
        print("\n" + "=" * 60)
        print("Successfully added fields")
        print("=" * 60)

        # Verify
        print("\nVerifying downloads table columns:")
        columns = db.execute(text('PRAGMA table_info(downloads)')).fetchall()
        for col in columns:
            if col[1] in new_fields:
                print(f"  {col[1]} ({col[2]})")

    except Exception as e:
        db.rollback()
        print(f"\nMigration failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        migrate()
    except Exception as e:
        print(f"\nMigration failed: {e}")
        sys.exit(1)