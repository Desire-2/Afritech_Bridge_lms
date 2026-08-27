"""Add booking system tables

Revision ID: b1c2d3e4f5a6
Revises: a1b2c3d4e5f6
Create Date: 2026-08-25 12:00:00.000000

Adds instructor_availability, availability_exceptions, and bookings tables
for the native one-to-one session booking system.

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = 'b1c2d3e4f5a6'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = set(inspector.get_table_names())

    # instructor_availability
    if 'instructor_availability' not in existing_tables:
        op.create_table(
            'instructor_availability',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('instructor_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
            sa.Column('day_of_week', sa.Integer(), nullable=False),
            sa.Column('start_time', sa.Time(), nullable=False),
            sa.Column('end_time', sa.Time(), nullable=False),
            sa.Column('timezone', sa.String(length=50), nullable=False, server_default='UTC'),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
            sa.Column('effective_from', sa.Date(), nullable=True),
            sa.Column('effective_until', sa.Date(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
            sa.CheckConstraint('day_of_week >= 0 AND day_of_week <= 6', name='ck_availability_day_range'),
            sa.CheckConstraint('start_time < end_time', name='ck_availability_time_order'),
        )

    # availability_exceptions
    if 'availability_exceptions' not in existing_tables:
        op.create_table(
            'availability_exceptions',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('instructor_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
            sa.Column('date', sa.Date(), nullable=False, index=True),
            sa.Column('is_blocked', sa.Boolean(), nullable=False, server_default=sa.text('1')),
            sa.Column('start_time', sa.Time(), nullable=True),
            sa.Column('end_time', sa.Time(), nullable=True),
            sa.Column('reason', sa.String(length=255), nullable=True),
            sa.Column('timezone', sa.String(length=50), nullable=False, server_default='UTC'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
            sa.UniqueConstraint('instructor_id', 'date', 'start_time', name='uq_exception_instructor_date_time'),
        )

    # bookings
    if 'bookings' not in existing_tables:
        op.create_table(
            'bookings',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('student_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
            sa.Column('instructor_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
            sa.Column('course_id', sa.Integer(), sa.ForeignKey('courses.id'), nullable=True, index=True),
            sa.Column('start_datetime', sa.DateTime(), nullable=False, index=True),
            sa.Column('end_datetime', sa.DateTime(), nullable=False),
            sa.Column('timezone', sa.String(length=50), nullable=False, server_default='UTC'),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='confirmed', index=True),
            sa.Column('session_topic', sa.String(length=255), nullable=False),
            sa.Column('student_notes', sa.Text(), nullable=True),
            sa.Column('instructor_notes', sa.Text(), nullable=True),
            sa.Column('cancellation_reason', sa.Text(), nullable=True),
            sa.Column('cancelled_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('cancelled_at', sa.DateTime(), nullable=True),
            sa.Column('completed_at', sa.DateTime(), nullable=True),
            sa.Column('no_show_marked_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
            sa.CheckConstraint('start_datetime < end_datetime', name='ck_booking_time_order'),
            sa.CheckConstraint(
                "status IN ('pending','confirmed','cancelled','completed','no_show','rescheduled','declined')",
                name='ck_booking_status_values',
            ),
        )
        op.create_index('idx_booking_instructor_start', 'bookings', ['instructor_id', 'start_datetime'])
        op.create_index('idx_booking_student_status', 'bookings', ['student_id', 'status'])
        op.create_index('idx_booking_status_start', 'bookings', ['status', 'start_datetime'])


def downgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = set(inspector.get_table_names())

    if 'bookings' in existing_tables:
        op.drop_index('idx_booking_status_start', table_name='bookings')
        op.drop_index('idx_booking_student_status', table_name='bookings')
        op.drop_index('idx_booking_instructor_start', table_name='bookings')
        op.drop_table('bookings')

    if 'availability_exceptions' in existing_tables:
        op.drop_table('availability_exceptions')

    if 'instructor_availability' in existing_tables:
        op.drop_table('instructor_availability')
