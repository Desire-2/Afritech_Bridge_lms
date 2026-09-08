"""CLI commands: create/assign users/roles, reset passwords, seed permissions, seed dev data."""

import click
from flask.cli import with_appcontext

from ..extensions import db
from ..models import User, Role


@click.command('create-user')
@click.option('--email', required=True)
@click.option('--password', required=True)
@click.option('--role', default='service_agent', help='Comma-separated role codes')
@click.option('--superadmin', is_flag=True)
@with_appcontext
def create_user_command(email, password, role, superadmin):
    """Create a user (admin command)."""
    if User.query.filter_by(email=email).first():
        raise click.ClickException(f'User {email} already exists')
    user = User(email=email)
    user.set_password(password)
    user.is_super_admin = superadmin
    db.session.add(user)
    db.session.flush()
    for code in role.split(','):
        r = Role.query.filter_by(code=code.strip()).first()
        if r:
            user.roles.append(r)
    db.session.commit()
    click.echo(f'Created user {email} with roles: {role}')


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
    app.cli.add_command(reset_password_command)
    app.cli.add_command(assign_role_command)
    app.cli.add_command(seed_permissions_roles_command)