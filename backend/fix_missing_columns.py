#!/usr/bin/env python3
"""
Add all missing columns to PostgreSQL database while preserving existing data.
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()

from flask import Flask
from src.models.user_models import db
from src.models.course_models import *
from src.models.student_models import *
from src.models.quiz_progress_models import *
from src.models.achievement_models import *
from src.models.opportunity_models import *
from src.models.course_application import *

app = Flask(__name__)
database_url = os.getenv('DATABASE_URL')
if database_url:
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql+psycopg2://', 1)
    elif database_url.startswith('postgresql://') and '+psycopg2' not in database_url:
        database_url = database_url.replace('postgresql://', 'postgresql+psycopg2://', 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
else:
    db_path = os.path.join(os.path.dirname(__file__), 'instance', 'afritec_lms_db.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {'pool_pre_ping': True}
db.init_app(app)

# Map Python/SQLAlchemy types to PostgreSQL DDL types
def sa_type_to_pg(col):
    """Convert a SQLAlchemy column type to a PostgreSQL DDL string."""
    from sqlalchemy import String, Text, Integer, Float, Boolean, DateTime, JSON, Numeric, Date, LargeBinary
    t = col.type
    if isinstance(t, Boolean):
        return 'BOOLEAN'
    if isinstance(t, Integer):
        return 'INTEGER'
    if isinstance(t, Float):
        return 'DOUBLE PRECISION'
    if isinstance(t, Numeric):
        return f'NUMERIC({t.precision},{t.scale})' if t.precision else 'NUMERIC'
    if isinstance(t, String):
        length = t.length or 255
        return f'VARCHAR({length})'
    if isinstance(t, Text):
        return 'TEXT'
    if isinstance(t, DateTime):
        return 'TIMESTAMP WITHOUT TIME ZONE'
    if isinstance(t, Date):
        return 'DATE'
    if isinstance(t, JSON):
        return 'JSON'
    if isinstance(t, LargeBinary):
        return 'BYTEA'
    return 'TEXT'  # fallback

def default_value_sql(col):
    """Build a DEFAULT clause for the column if needed."""
    from sqlalchemy import Boolean, Integer, Float
    t = col.type
    if col.default is not None:
        arg = col.default.arg
        if callable(arg):
            return ''  # Can't translate Python callables
        if isinstance(t, Boolean):
            return f" DEFAULT {'TRUE' if arg else 'FALSE'}"
        if isinstance(t, (Integer, Float)):
            return f" DEFAULT {arg}"
        if isinstance(arg, str):
            safe = arg.replace("'", "''")
            return f" DEFAULT '{safe}'"
    return ''

with app.app_context():
    from sqlalchemy import inspect, text
    inspector = inspect(db.engine)
    existing_tables = set(inspector.get_table_names())

    # ── Phase 1: Create completely missing tables ──
    missing_tables = []
    for mapper in db.Model.registry.mappers:
        model = mapper.class_
        if hasattr(model, '__tablename__') and model.__tablename__ not in existing_tables:
            missing_tables.append(model.__tablename__)

    if missing_tables:
        print(f"Creating {len(missing_tables)} missing tables: {missing_tables}")
        db.create_all()
        # Refresh inspector
        inspector = inspect(db.engine)
        existing_tables = set(inspector.get_table_names())
        print("  ✅ Tables created")

    # ── Phase 2: Add missing columns to existing tables ──
    total_added = 0
    for mapper in db.Model.registry.mappers:
        model = mapper.class_
        if not hasattr(model, '__tablename__'):
            continue
        tname = model.__tablename__
        if tname not in existing_tables:
            continue

        existing_cols = {c['name'] for c in inspector.get_columns(tname)}
        model_cols = {c.name: c for c in model.__table__.columns}
        missing = set(model_cols.keys()) - existing_cols

        if not missing:
            continue

        print(f"\n📋 {tname} – adding {len(missing)} columns: {sorted(missing)}")
        for cname in sorted(missing):
            col = model_cols[cname]
            pg_type = sa_type_to_pg(col)
            default = default_value_sql(col)
            sql = f'ALTER TABLE "{tname}" ADD COLUMN "{cname}" {pg_type}{default}'
            try:
                db.session.execute(text(sql))
                db.session.commit()
                total_added += 1
                print(f"  ✅ {cname} ({pg_type})")
            except Exception as e:
                db.session.rollback()
                print(f"  ⚠️  {cname}: {e}")

    # ── Summary ──
    print(f"\n{'='*60}")
    print(f"Done – added {total_added} columns.")
    if missing_tables:
        print(f"Created tables: {missing_tables}")

    # ── Verify ──
    inspector = inspect(db.engine)
    still_missing = {}
    for mapper in db.Model.registry.mappers:
        model = mapper.class_
        if not hasattr(model, '__tablename__'):
            continue
        tname = model.__tablename__
        if tname not in inspector.get_table_names():
            still_missing[tname] = 'TABLE STILL MISSING'
            continue
        existing_cols = {c['name'] for c in inspector.get_columns(tname)}
        model_cols = {c.name for c in model.__table__.columns}
        diff = model_cols - existing_cols
        if diff:
            still_missing[tname] = sorted(diff)

    if still_missing:
        print("\n⚠️  Still missing after migration:")
        for t, c in sorted(still_missing.items()):
            print(f"  {t}: {c}")
    else:
        print("✅ All model columns now exist in the database.")
