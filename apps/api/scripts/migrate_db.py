"""
Database migration script

Used to create missing database tables and initialize default settings.
"""
import sys
import os

# Add project root directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.database import create_missing_tables, table_exists, engine


def main():
    """Main function"""
    print("🚀 Starting database migration...\n")
    
    # Show database URL
    print(f"📁 Database URL: {engine.url}\n")
    
    # Check current database status
    print("📊 Current database status:")
    tables = ['users', 'cookies', 'downloads', 'settings']
    for table in tables:
        exists = table_exists(table)
        status = "✅" if exists else "❌"
        print(f"  {status} {table} table {'exists' if exists else 'does not exist'}")
    
    print("\n🔧 Creating missing tables...")
    create_missing_tables()
    
    print("\n✅ Database migration completed!")
    
    # Final status
    print("\n📊 Final database status:")
    for table in tables:
        exists = table_exists(table)
        status = "✅" if exists else "❌"
        print(f"  {status} {table} table {'exists' if exists else 'does not exist'}")


if __name__ == "__main__":
    main()