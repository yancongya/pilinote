"""
迁移脚本：为 downloads 表添加 AI 笔记相关字段

用于添加以下列：
- ai_note_id (String) - 关联的 AI 笔记 ID
- ai_summary (Text) - AI 总结摘要
- ai_markdown (Text) - 完整 Markdown
- ai_style (String(50)) - 使用的风格
- ai_status (Enum) - AI 分析状态
- ai_error (Text) - AI 分析错误信息
"""

import sqlite3
import os
import sys


def migrate():
    db_path = "./data/pilinote.db"

    if not os.path.exists(db_path):
        print(f"数据库文件不存在: {db_path}")
        sys.exit(1)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 检查表是否存在
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='downloads'"
    )
    if not cursor.fetchone():
        print("downloads 表不存在")
        conn.close()
        sys.exit(1)

    # 添加 ai_note_id 列
    try:
        cursor.execute("ALTER TABLE downloads ADD COLUMN ai_note_id VARCHAR")
        print("✓ 添加 ai_note_id 列")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("✓ ai_note_id 列已存在")
        else:
            print(f"✗ 添加 ai_note_id 列失败: {e}")

    # 添加 ai_summary 列
    try:
        cursor.execute("ALTER TABLE downloads ADD COLUMN ai_summary TEXT")
        print("✓ 添加 ai_summary 列")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("✓ ai_summary 列已存在")
        else:
            print(f"✗ 添加 ai_summary 列失败: {e}")

    # 添加 ai_markdown 列
    try:
        cursor.execute("ALTER TABLE downloads ADD COLUMN ai_markdown TEXT")
        print("✓ 添加 ai_markdown 列")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("✓ ai_markdown 列已存在")
        else:
            print(f"✗ 添加 ai_markdown 列失败: {e}")

    # 添加 ai_style 列
    try:
        cursor.execute("ALTER TABLE downloads ADD COLUMN ai_style VARCHAR(50)")
        print("✓ 添加 ai_style 列")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("✓ ai_style 列已存在")
        else:
            print(f"✗ 添加 ai_style 列失败: {e}")

    # 添加 ai_status 列
    try:
        cursor.execute("ALTER TABLE downloads ADD COLUMN ai_status VARCHAR(20)")
        print("✓ 添加 ai_status 列")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("✓ ai_status 列已存在")
        else:
            print(f"✗ 添加 ai_status 列失败: {e}")

    # 添加 ai_error 列
    try:
        cursor.execute("ALTER TABLE downloads ADD COLUMN ai_error TEXT")
        print("✓ 添加 ai_error 列")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("✓ ai_error 列已存在")
        else:
            print(f"✗ 添加 ai_error 列失败: {e}")

    # 添加 transcript 列
    try:
        cursor.execute("ALTER TABLE downloads ADD COLUMN transcript TEXT")
        print("✓ 添加 transcript 列")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("✓ transcript 列已存在")
        else:
            print(f"✗ 添加 transcript 列失败: {e}")

    # 添加 transcript_lang 列
    try:
        cursor.execute("ALTER TABLE downloads ADD COLUMN transcript_lang VARCHAR(10)")
        print("✓ 添加 transcript_lang 列")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("✓ transcript_lang 列已存在")
        else:
            print(f"✗ 添加 transcript_lang 列失败: {e}")

    conn.commit()
    conn.close()

    print("\n迁移完成！")


if __name__ == "__main__":
    migrate()
