"""Instructor weekly planning + performance scoring tests."""
from app.extensions import db


def _hdr(token):
    return {'Authorization': f'Bearer {token}'}


def _login(client, email, password='Password123!'):
    r = client.post('/api/auth/login', json={'email': email, 'password': password})
    assert r.status_code == 200, r.get_data(as_text=True)
    return r.get_json()['access_token']


class TestWeeklyPlans:
    def test_seed_plan_has_activities_and_progress(self, client):
        admin = _login(client, 'admin@afritech.dev')
        r = client.get('/api/instructors/weekly-plans/list?per_page=10', headers=_hdr(admin))
        assert r.status_code == 200, r.get_data(as_text=True)
        data = r.get_json()
        assert data['total'] >= 1
        plan = data['items'][0]
        assert 'title' in plan
        assert 'week_start' in plan and 'week_end' in plan
        assert plan['activity_count'] >= 1
        assert plan['completed_count'] >= 1       # seeded plan has a 'done' activity
        assert plan['progress_percent'] > 0
        details = plan['activities_details']
        assert len(details) == plan['activity_count']
        assert all(a['status'] in ('planned', 'done', 'cancelled', 'missed') for a in details)

    def test_progress_counts_done_activities(self, client):
        """progress_percent = done/(done+planned) semantics."""
        admin = _login(client, 'admin@afritech.dev')
        r = client.get('/api/instructors/weekly-plans/list?per_page=10', headers=_hdr(admin))
        plan = r.get_json()['items'][0]
        details = plan['activities_details']
        done = sum(1 for a in details if a['status'] in ('done', 'completed', 'cancelled'))
        assert int(plan['completed_count']) == done
        assert int(plan['progress_percent']) == round(done / max(len(details), 1) * 100)


class TestInstructorPerformance:
    def test_calculation_returns_all_components(self, client):
        admin = _login(client, 'admin@afritech.dev')
        r = client.get('/api/instructors', headers=_hdr(admin))
        assert r.status_code == 200
        instructor_id = r.get_json()['items'][0]['id']

        r = client.post(
            f'/api/instructors/{instructor_id}/performance/calculate',
            headers=_hdr(admin),
            json={'period_start': '2026-09-01', 'period_end': '2026-09-30'}
        )
        assert r.status_code == 200, r.get_data(as_text=True)
        score = r.get_json()['score']
        assert 'overall_score' in score
        assert float(score['overall_score']) >= 0
        assert 'rating' in score
        comps = {c['code'] for c in score['components']}
        assert {'teaching_delivery', 'weekly_planning', 'learner_progress',
                'assignment_management', 'attendance', 'reporting'} <= comps