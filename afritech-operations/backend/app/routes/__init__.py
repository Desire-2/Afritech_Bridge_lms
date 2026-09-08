from . import (
    auth, users, employees, services, clients, transactions, commissions,
    closings, expenses, payroll, attendance, tasks, instructors, reports,
    dashboard, notifications, audit, settings, integrations,
)


def register_routes(app):
    for bp in [
        auth.bp, users.bp, employees.bp, services.bp, clients.bp,
        transactions.bp, commissions.bp, closings.bp, expenses.bp,
        payroll.bp, attendance.bp, tasks.bp, instructors.bp,
        reports.bp, dashboard.bp, notifications.bp, audit.bp,
        settings.bp, integrations.bp,
    ]:
        app.register_blueprint(bp)

    @app.get('/api/health')
    def health():
        from ..extensions import db
        ok = True
        try:
            db.session.execute(db.text('SELECT 1'))
        except Exception:
            ok = False
        return {'status': 'ok' if ok else 'degraded'}

    @app.get('/api/meta')
    def meta():
        from ..models import Setting
        name = Setting.query.filter_by(key='business.name').first()
        currency = Setting.query.filter_by(key='business.currency').first()
        return {
            'application': 'AfriTech Bridge Operations',
            'business_name': name.value if name else 'AfriTech Bridge Operations',
            'currency': currency.value if currency else 'RWF',
        }