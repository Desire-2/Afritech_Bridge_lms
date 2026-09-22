"""CLI commands: create/assign users/roles, reset passwords, seed permissions, seed dev data."""

import click
from flask.cli import with_appcontext

from ..extensions import db
from ..models import User, Role, Employee
from ..services.employee_link import ensure_employee_for_user


@click.command('create-user')
@click.option('--email', required=True)
@click.option('--password', required=True)
@click.option('--role', default='service_agent', help='Comma-separated role codes')
@click.option('--superadmin', is_flag=True)
@with_appcontext
def create_user_command(email, password, role, superadmin):
    """Create a user with a linked employee record (admin command)."""
    if User.query.filter_by(email=email).first():
        raise click.ClickException(f'User {email} already exists')
    user = User(email=email)
    user.set_password(password)
    user.is_super_admin = superadmin
    db.session.add(user)
    db.session.flush()
    role_codes = [c.strip() for c in role.split(',') if c.strip()]
    for code in role_codes:
        r = Role.query.filter_by(code=code).first()
        if r:
            user.roles.append(r)
    employee = ensure_employee_for_user(user, roles=role_codes)
    db.session.commit()
    click.echo(f'Created user {email} with roles: {role}')
    click.echo(f'Linked employee: {employee.employee_number} ({employee.full_name})')


@click.command('backfill-employees')
@with_appcontext
def backfill_employees_command():
    """Create or link employee records for existing users that have none.

    Fixes users created before employee auto-linking existed: each orphan user
    either gets a new employee record or is linked to an existing unlinked
    employee with the same email (no duplicates).
    """
    created = linked = already = 0
    for user in User.query.order_by(User.id).all():
        if user.employee:
            already += 1
            continue
        had_unlinked_match = Employee.query.filter_by(email=user.email) \
            .filter(Employee.user_id.is_(None)).first() is not None
        employee = ensure_employee_for_user(user, roles=[r.code for r in user.roles])
        if had_unlinked_match:
            linked += 1
            click.echo(f'Linked  {user.email} -> existing {employee.employee_number} ({employee.full_name})')
        else:
            created += 1
            click.echo(f'Created {user.email} -> {employee.employee_number} ({employee.full_name})')
    db.session.commit()
    click.echo(f'Backfill complete: {created} created, {linked} linked, {already} already linked')


@click.command('reset-password')
@click.option('--email', required=True)
@click.option('--password', required=True)
@with_appcontext
def reset_password_command(email, password):
    user = User.query.filter_by(email=email).first()
    if not user:
        raise click.ClickException(f'User {email} not found')
    user.set_password(password)
    db.session.commit()
    click.echo(f'Password reset for {email}')


@click.command('assign-role')
@click.option('--email', required=True)
@click.option('--role', required=True, help='Comma-separated role codes')
@click.option('--replace', is_flag=True, default=False, help='Replace existing roles')
@with_appcontext
def assign_role_command(email, role, replace):
    user = User.query.filter_by(email=email).first()
    if not user:
        raise click.ClickException(f'User {email} not found')
    if replace:
        user.roles = []
    for code in role.split(','):
        r = Role.query.filter_by(code=code.strip()).first()
        if r:
            user.roles.append(r)
    db.session.commit()
    click.echo(f'Assigned roles {role} to {email}')


@click.command('seed-permissions-roles')
@with_appcontext
def seed_permissions_roles_command():
    from ..auth.permissions import seed_permissions_and_roles
    seed_permissions_and_roles()
    click.echo('Permissions and system roles seeded')


def register_cli(app):
    app.cli.add_command(create_user_command)
    app.cli.add_command(backfill_employees_command)
    app.cli.add_command(reset_password_command)
    app.cli.add_command(assign_role_command)
    app.cli.add_command(seed_permissions_roles_command)