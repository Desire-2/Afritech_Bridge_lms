"""Rebuild the bookings table to include 'declined' in the status CHECK constraint.

SQLite cannot ALTER a CHECK constraint, so we rebuild the table. Preserves all
columns, foreign keys, and indexes, and copies existing row data.
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'instance', 'afritec_lms_db.db')

conn = sqlite3.connect(DB_PATH)
conn.execute('PRAGMA foreign_keys = OFF')

# Verify current constraint is the buggy one (check the status value list specifically)
row = conn.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='bookings'").fetchone()
import re
m = re.search(r"ck_booking_status_values\s*CHECK\s*\(status IN \(([^)]*)\)\)", row[0] or '')
values = {v.strip().strip("'\"") for v in m.group(1).split(',')} if m else set()
if 'declined' in values:
    # Already has declined; nothing to do
    print('Constraint already includes declined; no rebuild needed.')
else:
    # Rebuild table (create_new, copy, drop, rename, indexes)
    conn.execute('''
    CREATE TABLE bookings_new (
        id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        instructor_id INTEGER NOT NULL,
        course_id INTEGER,
        start_datetime DATETIME NOT NULL,
        end_datetime DATETIME NOT NULL,
        timezone VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL,
        session_topic VARCHAR(255) NOT NULL,
        student_notes TEXT,
        instructor_notes TEXT,
        cancellation_reason TEXT,
        cancelled_by INTEGER,
        cancelled_at DATETIME,
        completed_at DATETIME,
        no_show_marked_at DATETIME,
        created_at DATETIME,
        updated_at DATETIME,
        confirmed_at DATETIME,
        confirmed_by INTEGER,
        declined_at DATETIME,
        declined_by INTEGER,
        meeting_url VARCHAR(500),
        meeting_provider VARCHAR(50),
        reminder_24h_sent BOOLEAN DEFAULT 0,
        reminder_1h_sent BOOLEAN DEFAULT 0,
        PRIMARY KEY (id),
        CONSTRAINT ck_booking_time_order CHECK (start_datetime < end_datetime),
        CONSTRAINT ck_booking_status_values CHECK (status IN ('pending','confirmed','cancelled','completed','no_show','rescheduled','declined')),
        FOREIGN KEY(cancelled_by) REFERENCES users (id),
        FOREIGN KEY(course_id) REFERENCES courses (id),
        FOREIGN KEY(instructor_id) REFERENCES users (id),
        FOREIGN KEY(student_id) REFERENCES users (id),
        FOREIGN KEY(declined_by) REFERENCES users (id),
        FOREIGN KEY(confirmed_by) REFERENCES users (id)
    )
    ''')

    conn.execute('''
    INSERT INTO bookings_new
    SELECT id, student_id, instructor_id, course_id, start_datetime, end_datetime,
           timezone, status, session_topic, student_notes, instructor_notes,
           cancellation_reason, cancelled_by, cancelled_at, completed_at,
           no_show_marked_at, created_at, updated_at, confirmed_at, confirmed_by,
           declined_at, declined_by, meeting_url, meeting_provider,
           reminder_24h_sent, reminder_1h_sent
    FROM bookings
    ''')

    conn.execute('DROP TABLE bookings')
    conn.execute('ALTER TABLE bookings_new RENAME TO bookings')

    # Recreate indexes
    conn.execute('CREATE INDEX ix_bookings_start_datetime ON bookings (start_datetime)')
    conn.execute('CREATE INDEX idx_booking_instructor_start ON bookings (instructor_id, start_datetime)')
    conn.execute('CREATE INDEX ix_bookings_instructor_id ON bookings (instructor_id)')
    conn.execute('CREATE INDEX ix_bookings_status ON bookings (status)')
    conn.execute('CREATE INDEX idx_booking_student_status ON bookings (student_id, status)')
    conn.execute('CREATE INDEX ix_bookings_course_id ON bookings (course_id)')
    conn.execute('CREATE INDEX idx_booking_status_start ON bookings (status, start_datetime)')
    conn.execute('CREATE INDEX ix_bookings_student_id ON bookings (student_id)')

    conn.execute('PRAGMA foreign_key_check')
    conn.commit()
    print('Rebuilt bookings table with declined in status constraint.')

conn.execute('PRAGMA foreign_keys = ON')
conn.close()
