"""Quick end-to-end smoke test via Flask test client. Idempotent: reseeds a fresh dev DB on every run."""
from app import create_app
from app.seeds import seed_dev

app = create_app('development')
app.config['TESTING'] = True

with app.app_context():
    seed_dev()

client = app.test_client()


def login(email, password):
    r = client.post('/api/auth/login', json={'email': email, 'password': password})
    assert r.status_code == 200, r.get_data(as_text=True)
    return r.get_json()['access_token']


def headers(token):
    return {'Authorization': f'Bearer {token}'}


admin_token = login('admin@afritech.dev', 'Password123!')
agent_token = login('agent@afritech.dev', 'Password123!')
print('1. LOGIN OK (admin + agent)')

# unauthenticated access
r = client.get('/api/employees')
assert r.status_code == 401, r.status_code
print('2. UNAUTH ACCESS BLOCKED OK')

# admin views employees
r = client.get('/api/employees', headers=headers(admin_token))
assert r.status_code == 200, r.get_data(as_text=True)
print('3. EMPLOYEES LIST OK, total =', r.get_json()['total'])

# services
r = client.get('/api/services', headers=headers(agent_token))
data = r.get_json()['items']
print('4. SERVICES visible to agent:', len(data))
birth = [s for s in data if s['name'] == 'Birth Certificate'][0]

# clients
r = client.get('/api/clients', headers=headers(agent_token), query_string={'search': 'Aline'})
clients = r.get_json()['items']
print('5. CLIENT SEARCH OK:', clients[0]['full_name'] if clients else 'none')
client_id = clients[0]['id'] if clients else None

# payment methods
r = client.get('/api/services/payment-methods', headers=headers(agent_token))
pms = r.get_json()['payment_methods']
cash = [p for p in pms if p['code'] == 'cash'][0]

# reset the Birth Certificate price so the price-snapshot assertions below are deterministic
r = client.put(f"/api/services/{birth['id']}", headers=headers(admin_token), json={'customer_price': 900, 'official_cost': 500})
assert r.status_code == 200, r.get_data(as_text=True)

# create transaction as agent: Birth cert 900 - 500 = 400, 20% -> 80/320
r = client.post('/api/transactions', headers=headers(agent_token), json={
    'service_id': birth['id'], 'client_id': client_id, 'payment_method_id': cash['id'],
})
assert r.status_code == 201, r.get_data(as_text=True)
txn = r.get_json()['transaction']
print('6. TXN CREATED:', txn['transaction_number'])
assert float(txn['gross_profit']) == 400.0, txn
assert float(txn['commission_amount']) == 80.0, txn
assert float(txn['company_profit']) == 320.0, txn
print('   commission calc OK: 400 x 20% = 80, company = 320')

# historical price snapshot: change service price, ensure old txn unchanged
r = client.put(f"/api/services/{birth['id']}", headers=headers(admin_token), json={'customer_price': 1200})
assert r.status_code == 200
r = client.get(f"/api/transactions/{txn['id']}", headers=headers(admin_token))
assert float(r.get_json()['transaction']['customer_price']) == 900.0  # unchanged snapshot
r = client.get(f"/api/transactions/{txn['id']}", headers=headers(agent_token))
old = r.get_json()['transaction']
assert float(old['customer_price']) == 900.0, old
print('7. HISTORICAL SNAPSHOT OK: old txn still 900 after price changed to 1200')

# agent cannot view another employee's transactions
r = client.get('/api/employees/1/transactions', headers=headers(agent_token))
assert r.status_code == 403, (r.status_code, r.get_data(as_text=True))
print('8. AGENT CROSS-EMPLOYEE TXN BLOCKED OK (403 =', r.status_code, ')')

# daily closing totals + submit (agent)
r = client.get('/api/closings/totals', headers=headers(agent_token))
print('9. CLOSING TOTALS PREDICTED:', r.get_json()['totals'])
r = client.post('/api/closings/submit', headers=headers(agent_token), json={'actual_cash': 98000})
assert r.status_code == 201, r.get_data(as_text=True)
closing = r.get_json()['closing']
print('10. CLOSING SUBMITTED, status =', closing['status'])

# manager approves
manager_token = login('manager@afritech.dev', 'Password123!')
r = client.post(f"/api/closings/{closing['id']}/review", headers=headers(manager_token), json={'decision': 'approved'})
assert r.status_code == 200, r.get_data(as_text=True)
print('11. CLOSING APPROVED + LOCKED, locked =', r.get_json()['closing']['is_locked'])

# payroll period
r = client.post('/api/payroll/periods', headers=headers(admin_token), json={
    'name': 'September 2026', 'period_start': '2026-09-01', 'period_end': '2026-09-30'})
assert r.status_code == 201, r.get_data(as_text=True)
period = r.get_json()['period']
print('12. PAYROLL PERIOD CREATED, items =', period['item_count'])

# reports
r = client.get('/api/reports/summary', headers=headers(manager_token), query_string={'start': '2026-08-01', 'end': '2026-09-30'})
assert r.status_code == 200, r.get_data(as_text=True)
print('13. REPORT SUMMARY revenue =', r.get_json()['revenue'], 'commissions =', r.get_json()['commissions'])

# dashboard
r = client.get('/api/dashboard', headers=headers(manager_token))
assert r.status_code == 200, r.get_data(as_text=True)
print('14. DASHBOARD OK, today revenue =', r.get_json()['financial']['today_revenue'])

# export CSV
r = client.get('/api/reports/export/csv', headers=headers(manager_token), query_string={'report': 'revenue', 'start': '2026-08-01', 'end': '2026-09-30'})
assert r.status_code == 200
print('15. CSV EXPORT OK, bytes =', len(r.data))

# export Excel
r = client.get('/api/reports/export/excel', headers=headers(manager_token), query_string={'report': 'revenue', 'start': '2026-08-01', 'end': '2026-09-30'})
assert r.status_code == 200, r.get_data(as_text=True)
print('16. EXCEL EXPORT OK, bytes =', len(r.data))

# instructor: weekly plan + performance
instr_token = login('instructor@afritech.dev', 'Password123!')
r = client.get('/api/instructors', headers=headers(manager_token))
instructors = r.get_json()['items']
instr_id = instructors[0]['id']
r = client.get('/api/instructors/courses/list', headers=headers(instr_token))
courses = r.get_json()['courses']
r = client.get('/api/instructors/cohorts/list', headers=headers(instr_token))
cohorts = r.get_json()['items']
if courses and cohorts:
    from datetime import date, timedelta
    ws = date(2026, 9, 7)
    we = ws + timedelta(days=6)
    r = client.post('/api/instructors/weekly-plans', headers=headers(instr_token), json={
        'week_start': ws.isoformat(), 'week_end': we.isoformat(), 'title': 'Excel week 1',
        'activities': [
            {'activity_date': ws.isoformat(), 'course_id': courses[0]['id'], 'cohort_id': cohorts[0]['id'],
             'module': 'Formulas', 'lesson': 'Intro', 'activity': 'Teach formulas', 'expected_outcome': 'Basic formulas', 'duration_hours': 2},
            {'activity_date': (ws + timedelta(days=1)).isoformat(), 'course_id': courses[0]['id'], 'cohort_id': cohorts[0]['id'],
             'module': 'Formulas', 'lesson': 'Pivot', 'activity': 'Pivot tables exercise', 'expected_outcome': 'Pivot tables', 'duration_hours': 2},
        ]})
    assert r.status_code == 201, r.get_data(as_text=True)
    plan = r.get_json()['plan']
    print('17. WEEKLY PLAN CREATED with', plan['activity_count'], 'activities')
    # mark one activity done
    activity_id = plan['activities_details'][0]['id']
    r = client.get('/api/instructors/weekly-plans/list', headers=headers(instr_token), query_string={'id': plan['id']})
    r = client.put(f"/api/instructors/weekly-plans/{plan['id']}/activities/{activity_id}", headers=headers(instr_token), json={'status': 'done'})
    assert r.status_code == 200, r.get_data(as_text=True)
    r = client.post(f'/api/instructors/{instr_id}/performance/calculate', headers=headers(manager_token), json={'period_start': '2026-09-01', 'period_end': '2026-09-30'})
    assert r.status_code == 200, r.get_data(as_text=True)
    print('18. INSTRUCTOR PERFORMANCE SCORED =', r.get_json()['score']['overall_score'])

# audit log
r = client.get('/api/audit', headers=headers(admin_token))
assert r.status_code == 200
print('19. AUDIT LOG OK, entries =', r.get_json()['total'])

# notifications
r = client.get('/api/notifications', headers=headers(manager_token))
assert r.status_code == 200
print('20. NOTIFICATIONS OK, total =', r.get_json()['total'])

print('\nALL SMOKE TESTS PASSED')