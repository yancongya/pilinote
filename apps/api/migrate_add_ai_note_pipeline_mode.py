"""Add pipeline_mode to ai_notes.

This migration keeps AI note records compatible with the new pipeline mode
tracking introduced in the note service and UI.
"""

import sqlite3
from pathlib import Path


DB_PATH = Path(__file__).resolve().parent / "data" / "pilinote.db"


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(ai_notes)")
        columns = {row[1] for row in cursor.fetchall()}
        if "pipeline_mode" not in columns:
            cursor.execute("ALTER TABLE ai_notes ADD COLUMN pipeline_mode VARCHAR(20)")
            cursor.execute("CREATE INDEX IF NOT EXISTS ix_ai_notes_pipeline_mode ON ai_notes (pipeline_mode)")
            conn.commit()
            print("Added pipeline_mode to ai_notes")
        else:
            print("pipeline_mode already exists on ai_notes")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
