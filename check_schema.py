#!/usr/bin/env python3

"""
Check actual database schema
"""

import sqlite3
import os

DB_PATH = "/home/desire/My_Project/AB/afritec_bridge_lms/backend/instance/afritec_lms_db.db"

def check_actual_schema():
    """Check what tables actually exist"""
    
    if not os.path.exists(DB_PATH):
        print(f"❌ Database not found at {DB_PATH}")
        return
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        print("Actual Database Schema")
        print("=" * 50)
        
        # Get all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        
        print(f"📊 Found {len(tables)} tables:")
        for table in tables:
            table_name = table[0]
            print(f"\n🔸 {table_name.upper()}")
            
            # Get table info
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = cursor.fetchall()
            for col in columns:
                print(f"   - {col[1]} ({col[2]})")
            
            # Get row count
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                count = cursor.fetchone()[0]
                print(f"   📈 Rows: {count}")
            except:
                print(f"   ❌ Cannot count rows")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Database error: {e}")

if __name__ == "__main__":
    check_actual_schema()