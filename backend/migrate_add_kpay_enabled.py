#!/usr/bin/env python3
"""
Migration: add kpay_enabled boolean column to the course table.
Defaults to TRUE so all existing courses show K-Pay immediately without
any manual re-configuration by instructors.

Run once:
    cd backend && python3 migrate_add_kpay_enabled.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()

from flask import Flask
from src.models.user_models import db

app = Flask(__name__)
database_url = os.getenv('DATABASE_URL')
if database_url:
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql+psycopg2://', 1)
    elif database_url.startswith('postgresql://') and '+psycopg2' not in database_url:
        database_url = database_url.replace('postgresql://', 'postgresql+psycopg2://', 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    is_postgres = True
else:
    db_path = os.path.join(os.path.dirname(__file__), 'instance', 'afritec_lms_db.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
    is_postgres = False

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

with app.app_context():
    conn = db.engine.connect()
    try:
        if is_postgres:
            # Check if column exists
            result = conn.execute(db.text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='courses' AND column_name='kpay_enabled'"
            ))
            exists = result.fetchone() is not None
            if not exists:
                conn.execute(db.text(
                    "ALTER TABLE courses ADD COLUMN kpay_enabled BOOLEAN NOT NULL DEFAULT TRUE"
                ))
                conn.commit()
                print("✓ PostgreSQL: added kpay_enabled column (default TRUE)")
            else:
                print("✓ PostgreSQL: kpay_enabled column already exists — nothing to do")
        else:
            # SQLite: check existing columns via PRAGMA
            result = conn.execute(db.text("PRAGMA table_info(courses)"))
            cols = [row[1] for row in result.fetchall()]
            if 'kpay_enabled' not in cols:
                conn.execute(db.text(
                    "ALTER TABLE courses ADD COLUMN kpay_enabled BOOLEAN NOT NULL DEFAULT 1"
                ))
                conn.commit()
                print("✓ SQLite: added kpay_enabled column (default 1/TRUE)")
            else:
                print("✓ SQLite: kpay_enabled column already exists — nothing to do")
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        raise
    finally:
        conn.close()

print("Migration complete.")
