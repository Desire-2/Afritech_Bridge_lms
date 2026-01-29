#!/usr/bin/env python3

import os
import psycopg2
from urllib.parse import urlparse

def test_connection_and_migrate():
    # Database URL from your .env
    database_url = "postgresql://lms1_user:8XpfYDobJ9bqdEo1fe7hIZp2Bk0s7U05@dpg-d5q6duv5r7bs738dd0g0-a.virginia-postgres.render.com/lms1"
    
    try:
        # Parse the database URL
        url = urlparse(database_url)
        
        print("🔍 Testing PostgreSQL connection...")
        print(f"Host: {url.hostname}")
        print(f"Database: {url.path[1:]}")
        print(f"User: {url.username}")
        
        # Connect to PostgreSQL
        conn = psycopg2.connect(
            host=url.hostname,
            port=url.port or 5432,
            database=url.path[1:],
            user=url.username,
            password=url.password
        )
        
        cursor = conn.cursor()
        
        # Test the connection
        cursor.execute("SELECT current_database(), current_user, version();")
        result = cursor.fetchone()
        print(f"✅ Connected successfully!")
        print(f"Database: {result[0]}")
        print(f"User: {result[1]}")
        print(f"Version: {result[2][:50]}...")
        print()
        
        # Check existing tables
        cursor.execute("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        tables = cursor.fetchall()
        print(f"📊 Current tables ({len(tables)}):")
        for table in tables[:10]:  # Show first 10 tables
            print(f"  - {table[0]}")
        if len(tables) > 10:
            print(f"  ... and {len(tables) - 10} more tables")
        print()
        
        # Close connection
        cursor.close()
        conn.close()
        
        print("🚀 Connection test successful! Ready to run migration.")
        print("You can now run the migration script directly with psql:")
        print("psql 'postgresql://lms1_user:8XpfYDobJ9bqdEo1fe7hIZp2Bk0s7U05@dpg-d5q6duv5r7bs738dd0g0-a.virginia-postgres.render.com/lms1' -f postgresql_migration_safe.sql")
        
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

if __name__ == "__main__":
    test_connection_and_migrate()