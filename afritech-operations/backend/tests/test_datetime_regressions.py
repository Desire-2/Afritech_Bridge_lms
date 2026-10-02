"""Regressions for naive/aware datetime handling and session-less JWTs.

SQLite returns naive datetimes even for `DateTime(timezone=True)` columns, so
any Python-level arithmetic or comparison against an aware `now()` used to raise
`TypeError: can't subtract offset-naive and offset-aware datetimes` — a 500 on
clock-out and on password-reset token validation. A valid JWT whose session row
is gone used to 500 on the sessions endpoints instead of returning 401.
"""
from datetime import date, datetime, timedelta, timezone

from flask_jwt_extended import create_access_token

from app.extensions import db
from app.models import Attendance, PasswordResetToken, User
from app.routes.attendance import compute_hours
from app.routes.auth import hash_token
from app.utils.datetime_utils import as_utc


class TestComputeHours:
    def test_mixed_naive_and_aware(self):
        # the exact shape that crashed: value read back from SQLite (naive)
        # minus the aware `now()` written by clock-out
        assert compute_hours(
            datetime(2026, 10, 2, 8, 0),
            datetime(2026, 10, 2, 17, 0, tzinfo=timezone.utc),
        ) == 9.0

    def test_both_naive(self):
        assert compute_hours(
            datetime(2026, 10, 2, 8, 0), datetime(2026, 10, 2, 16, 30)) == 8.5

    def test_both_aware(self):
        assert compute_hours(
            datetime(2026, 10, 2, 8, 0, tzinfo=timezone.utc),
            datetime(2026, 10, 2, 14, 0, tzinfo=timezone(timedelta(hours=2))),
        ) == 4.0  # 08:00Z -> 12:00Z

    def test_missing_values(self):
        assert compute_hours(None, datetime.now(timezone.utc)) == 0
        assert compute_hours(datetime.now(timezone.utc), None) == 0


class TestAsUtc:
    def test_none_passthrough(self):
        assert as_utc(None) is None

    def test_naive_assumed_utc(self):
        naive = datetime(2026, 10, 2, 8, 0)
        aware = as_utc(naive)
        assert aware.tzinfo is not None
        assert aware.utcoffset() == timedelta(0)
        assert aware.hour == 8

    def test_converts_other_zones(self):
        kigali = datetime(2026, 10, 2, 10, 0, tzinfo=timezone(timedelta(hours=2)))
        assert as_utc(kigali).hour == 8


class TestClockOut:
    def test_clock_out_over_naive_clock_in(self, client, agent_hdr):
        user = User.query.filter_by(email='agent@afritech.dev').first()
        today = date.today()
        rec = Attendance.query.filter_by(employee_id=user.employee.id,
                                         attendance_date=today).first()
        if not rec:
            rec = Attendance(employee_id=user.employee.id, attendance_date=today,
                             status='present')
            db.session.add(rec)
        # exactly what the ORM hands back on SQLite: no offset
        rec.clock_in = datetime(today.year, today.month, today.day, 8, 0)
        rec.clock_out = None
        rec.total_hours = None
        db.session.commit()

        r = client.post('/api/attendance/clock-out', headers=agent_hdr)
        assert r.status_code == 200, r.get_json()
        body = r.get_json()
        assert body['attendance']['clock_out'] is not None
        assert body['attendance']['total_hours'] is not None

    def test_record_route_with_mixed_bounds(self, client, manager_hdr):
        employee = User.query.filter_by(email='agent@afritech.dev').first().employee
        r = client.post('/api/attendance/record', headers=manager_hdr, json={
            'employee_id': employee.id,
            'attendance_date': date.today().isoformat(),
            'clock_in': '2026-10-02T08:00:00',   # naive on purpose
            'clock_out': '2026-10-02T17:00:00Z',  # aware
            'status': 'present',
        })
        assert r.status_code in (200, 201), r.get_json()
        assert r.get_json()['attendance']['total_hours'] == 9.0


class TestPasswordResetExpiry:
    def test_expired_token_is_400_not_500(self, client):
        user = User.query.filter_by(email='admin@afritech.dev').first()
        raw = 'expired-reset-token'
        db.session.add(PasswordResetToken(
            user_id=user.id, token_hash=hash_token(raw),
            expires_at=datetime.now(timezone.utc) - timedelta(minutes=1)))
        db.session.commit()

        r = client.post('/api/auth/reset-password',
                        json={'token': raw, 'new_password': 'Whatever123!'})
        assert r.status_code == 400, r.get_json()
        assert 'expired' in r.get_json()['error'].lower()


class TestSessionEndpoints:
    def test_live_session_lists_sessions(self, client, admin_hdr):
        r = client.get('/api/auth/sessions', headers=admin_hdr)
        assert r.status_code == 200
        assert r.get_json()['sessions']

    def test_sessions_is_401_when_session_row_is_gone(self, client, admin_hdr):
        # valid JWT, but its session was revoked/expired elsewhere
        orphan = create_access_token(identity='1')
        r = client.get('/api/auth/sessions',
                       headers={'Authorization': f'Bearer {orphan}'})
        assert r.status_code == 401
        assert r.get_json()['error']

    def test_revoke_is_401_when_session_row_is_gone(self, client, admin_hdr):
        orphan = create_access_token(identity='1')
        r = client.post('/api/auth/sessions/1/revoke',
                        headers={'Authorization': f'Bearer {orphan}'})
        assert r.status_code == 401

    def test_revoke_of_unknown_session_is_404(self, client, admin_hdr):
        r = client.post('/api/auth/sessions/999999/revoke', headers=admin_hdr)
        assert r.status_code == 404
