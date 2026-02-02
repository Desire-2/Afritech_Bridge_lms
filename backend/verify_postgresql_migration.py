#!/usr/bin/env python3
"""
Schema Verification Script for PostgreSQL Migration
Compares SQLite schema with PostgreSQL schema to ensure completeness
"""

import sqlite3
import psycopg2
import os
import sys
from urllib.parse import urlparse

def get_sqlite_tables():
    """Get table information from SQLite database"""
    db_path = "instance/afritec_lms_db.db"
    if not os.path.exists(db_path):
        print("❌ SQLite database not found at:", db_path)
        return {}
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]
    
    table_info = {}
    for table in tables:
        cursor.execute(f"PRAGMA table_info({table})")
        columns = [(col[1], col[2]) for col in cursor.fetchall()]  # (name, type)
        table_info[table] = columns
    
    conn.close()
    return table_info

def get_postgresql_tables(database_url=None):
    """Get table information from PostgreSQL database"""
    if database_url:
        # Parse DATABASE_URL
        parsed = urlparse(database_url)
        conn_params = {
            'host': parsed.hostname,
            'port': parsed.port,
            'database': parsed.path[1:],  # Remove leading slash
            'user': parsed.username,
            'password': parsed.password
        }
    else:
        # Use local PostgreSQL
        conn_params = {
            'host': 'localhost',
            'database': os.environ.get('POSTGRES_DB', 'afritec_lms'),
            'user': os.environ.get('POSTGRES_USER', 'postgres'),
            'password': os.environ.get('POSTGRES_PASSWORD', '')
        }
    
    try:
        conn = psycopg2.connect(**conn_params)
        cursor = conn.cursor()
        
        # Get all tables in public schema
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """)
        tables = [row[0] for row in cursor.fetchall()]
        
        table_info = {}
        for table in tables:
            cursor.execute("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = %s
                ORDER BY ordinal_position;
            """, (table,))
            columns = [(col[0], col[1]) for col in cursor.fetchall()]
            table_info[table] = columns
        
        conn.close()
        return table_info
        
    except psycopg2.Error as e:
        print(f"❌ Error connecting to PostgreSQL: {e}")
        return {}

def normalize_type(db_type, db_system):
    """Normalize data types for comparison"""
    db_type = db_type.upper()
    
    type_mapping = {
        'sqlite_to_pg': {
            'INTEGER': 'INTEGER',
            'TEXT': 'TEXT', 
            'VARCHAR': 'CHARACTER VARYING',
            'REAL': 'REAL',
            'BOOLEAN': 'BOOLEAN',
            'DATETIME': 'TIMESTAMP WITH TIME ZONE',
            'DATE': 'DATE',
            'FLOAT': 'REAL',
            'JSON': 'JSONB'
        }
    }
    
    if db_system == 'sqlite':
        # SQLite types are more flexible
        if 'VARCHAR' in db_type:
            return 'CHARACTER VARYING'
        elif db_type in ['INT', 'INTEGER']:
            return 'INTEGER'
        elif db_type in ['TEXT', 'CLOB']:
            return 'TEXT'
        elif db_type in ['REAL', 'FLOAT', 'DOUBLE']:
            return 'REAL'
        elif db_type == 'BOOLEAN':
            return 'BOOLEAN'
        elif db_type in ['DATETIME', 'TIMESTAMP']:
            return 'TIMESTAMP WITH TIME ZONE'
        elif db_type == 'DATE':
            return 'DATE'
        elif db_type == 'JSON':
            return 'JSONB'
    
    return db_type

def compare_schemas(sqlite_tables, postgresql_tables):
    """Compare SQLite and PostgreSQL schemas"""
    print("\n🔍 Schema Comparison Report")
    print("=" * 60)
    
    all_tables = set(sqlite_tables.keys()) | set(postgresql_tables.keys())
    missing_in_pg = set(sqlite_tables.keys()) - set(postgresql_tables.keys())
    extra_in_pg = set(postgresql_tables.keys()) - set(sqlite_tables.keys())
    common_tables = set(sqlite_tables.keys()) & set(postgresql_tables.keys())
    
    # Summary
    print(f"\n📊 Summary:")
    print(f"   Total SQLite tables: {len(sqlite_tables)}")
    print(f"   Total PostgreSQL tables: {len(postgresql_tables)}")
    print(f"   Common tables: {len(common_tables)}")
    print(f"   Missing in PostgreSQL: {len(missing_in_pg)}")
    print(f"   Extra in PostgreSQL: {len(extra_in_pg)}")
    
    # Missing tables
    if missing_in_pg:
        print(f"\n❌ Tables missing in PostgreSQL ({len(missing_in_pg)}):")
        for table in sorted(missing_in_pg):
            print(f"   - {table}")
            
    # Extra tables
    if extra_in_pg:
        print(f"\n➕ Extra tables in PostgreSQL ({len(extra_in_pg)}):")
        for table in sorted(extra_in_pg):
            print(f"   - {table}")
    
    # Column differences in common tables
    column_issues = []
    for table in sorted(common_tables):
        sqlite_cols = {col[0]: normalize_type(col[1], 'sqlite') for col in sqlite_tables[table]}
        pg_cols = {col[0]: normalize_type(col[1], 'postgresql') for col in postgresql_tables[table]}
        
        missing_cols = set(sqlite_cols.keys()) - set(pg_cols.keys())
        extra_cols = set(pg_cols.keys()) - set(sqlite_cols.keys())
        
        type_mismatches = []
        for col in set(sqlite_cols.keys()) & set(pg_cols.keys()):
            sqlite_type = sqlite_cols[col]
            pg_type = pg_cols[col]
            if sqlite_type != pg_type and not (
                (sqlite_type == 'INTEGER' and pg_type == 'INTEGER') or
                (sqlite_type == 'REAL' and pg_type in ['REAL', 'DOUBLE PRECISION']) or
                ('CHARACTER VARYING' in pg_type and sqlite_type == 'CHARACTER VARYING')
            ):
                type_mismatches.append((col, sqlite_type, pg_type))
        
        if missing_cols or extra_cols or type_mismatches:
            column_issues.append({
                'table': table,
                'missing_cols': missing_cols,
                'extra_cols': extra_cols,
                'type_mismatches': type_mismatches
            })
    
    if column_issues:
        print(f"\n⚠️  Column differences found in {len(column_issues)} tables:")
        for issue in column_issues:
            print(f"\n   Table: {issue['table']}")
            if issue['missing_cols']:
                print(f"      Missing columns: {', '.join(sorted(issue['missing_cols']))}")
            if issue['extra_cols']:
                print(f"      Extra columns: {', '.join(sorted(issue['extra_cols']))}")
            if issue['type_mismatches']:
                print(f"      Type mismatches:")
                for col, sqlite_type, pg_type in issue['type_mismatches']:
                    print(f"         {col}: SQLite={sqlite_type} vs PostgreSQL={pg_type}")
    
    # Overall status
    print(f"\n🎯 Migration Status:")
    if not missing_in_pg and not column_issues:
        print("   ✅ Migration appears complete and successful!")
    elif missing_in_pg:
        print("   ❌ Migration incomplete - tables missing")
    elif column_issues:
        print("   ⚠️  Migration may have column differences")
    else:
        print("   ✅ Migration looks good with minor differences")
    
    return len(missing_in_pg) == 0 and len(column_issues) == 0

def main():
    """Main verification function"""
    print("🔍 PostgreSQL Migration Verification")
    print("=" * 50)
    
    # Get DATABASE_URL from environment
    database_url = os.environ.get('DATABASE_URL')
    
    # Get SQLite schema
    print("\n📖 Reading SQLite schema...")
    sqlite_tables = get_sqlite_tables()
    if not sqlite_tables:
        sys.exit(1)
    print(f"   Found {len(sqlite_tables)} tables in SQLite")
    
    # Get PostgreSQL schema
    print("\n📖 Reading PostgreSQL schema...")
    if database_url:
        print(f"   Using DATABASE_URL: {database_url.split('@')[0]}@****")
    else:
        db_name = os.environ.get('POSTGRES_DB', 'afritec_lms')
        print(f"   Using local database: {db_name}")
    
    postgresql_tables = get_postgresql_tables(database_url)
    if not postgresql_tables:
        print("❌ Could not connect to PostgreSQL or database is empty")
        sys.exit(1)
    print(f"   Found {len(postgresql_tables)} tables in PostgreSQL")
    
    # Compare schemas
    success = compare_schemas(sqlite_tables, postgresql_tables)
    
    # Exit code
    if success:
        print("\n✅ Verification completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Verification found issues that need attention")
        sys.exit(1)

if __name__ == "__main__":
    main()