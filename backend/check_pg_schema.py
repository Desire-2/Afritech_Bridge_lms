#!/usr/bin/env python3
"""Quick check: all model columns vs PostgreSQL production."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv; load_dotenv()

from flask import Flask
from src.models.user_models import db
from src.models.course_models import *
from src.models.student_models import *
from src.models.quiz_progress_models import *
from src.models.achievement_models import *
from src.models.opportunity_models import *
from src.models.course_application import *

PG_URL = 'postgresql+psycopg2://lms_dged_user:MnGmpyxX9frGS3a8zgr3rpXvWgFJNAvR@dpg-d6bk2el6ubrc73cm063g-a.virginia-postgres.render.com/lms_dged'

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = PG_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {'pool_pre_ping': True}
db.init_app(app)

with app.app_context():
    from sqlalchemy import inspect
    inspector = inspect(db.engine)
    pg_tables = set(inspector.get_table_names())

    missing_tables = []
    missing_cols = {}
    for mapper in db.Model.registry.mappers:
        model = mapper.class_
        if not hasattr(model, '__tablename__'):
            continue
        tname = model.__tablename__
        if tname not in pg_tables:
            missing_tables.append(tname)
            continue
        existing = {c['name'] for c in inspector.get_columns(tname)}
        needed = {c.name for c in model.__table__.columns}
        diff = needed - existing
        if diff:
            missing_cols[tname] = sorted(diff)

    if missing_tables:
        print(f'MISSING TABLES: {missing_tables}')
    if missing_cols:
        print('MISSING COLUMNS:')
        for t, cols in sorted(missing_cols.items()):
            print(f'  {t}: {cols}')
    if not missing_tables and not missing_cols:
        print('OK - all model tables and columns exist in PostgreSQL')
