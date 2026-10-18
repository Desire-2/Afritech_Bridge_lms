"""Add integration-layer tables (API clients/keys, events, webhooks,
idempotency keys, audit log).

Purely additive: no existing table is altered, so the revision is safe to
apply on databases of any size and trivially reversible.

Revision ID: c3d4e5f6a7b8
Revises: b7e8f9a0c1d2
"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = 'c3d4e5f6a7b8'
down_revision = 'b7e8f9a0c1d2'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'api_clients',
        sa.Column('id', sa.String(length=32), primary_key=True),
        sa.Column('name', sa.String(length=160), nullable=False),
        sa.Column('slug', sa.String(length=80), nullable=False, unique=True),
        sa.Column('contact_email', sa.String(length=255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='active'),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('disabled_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_api_clients_slug', 'api_clients', ['slug'])
    op.create_index('ix_api_clients_status', 'api_clients', ['status'])

    op.create_table(
        'api_keys',
        sa.Column('id', sa.String(length=32), primary_key=True),
        sa.Column('client_id', sa.String(length=32),
                  sa.ForeignKey('api_clients.id'), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('key_prefix', sa.String(length=20), nullable=False, unique=True),
        sa.Column('key_hash', sa.String(length=64), nullable=False),
        sa.Column('scopes', sa.JSON(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_api_keys_client_id', 'api_keys', ['client_id'])
    op.create_index('ix_api_keys_key_prefix', 'api_keys', ['key_prefix'])

    op.create_table(
        'api_events',
        sa.Column('id', sa.String(length=32), primary_key=True),
        sa.Column('type', sa.String(length=80), nullable=False),
        sa.Column('subject_type', sa.String(length=40), nullable=True),
        sa.Column('subject_id', sa.String(length=32), nullable=True),
        sa.Column('payload', sa.JSON(), nullable=False),
        sa.Column('actor_user_id', sa.Integer(), nullable=True),
        sa.Column('source_client_id', sa.String(length=32), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_api_events_type', 'api_events', ['type'])
    op.create_index('ix_api_events_subject_id', 'api_events', ['subject_id'])
    op.create_index('ix_api_events_created_at', 'api_events', ['created_at'])

    op.create_table(
        'webhook_subscriptions',
        sa.Column('id', sa.String(length=32), primary_key=True),
        sa.Column('client_id', sa.String(length=32),
                  sa.ForeignKey('api_clients.id'), nullable=False),
        sa.Column('url', sa.String(length=500), nullable=False),
        sa.Column('events', sa.JSON(), nullable=False),
        sa.Column('secret', sa.String(length=80), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='active'),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('disabled_at', sa.DateTime(), nullable=True),
        sa.Column('last_delivery_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_webhook_subscriptions_client_id', 'webhook_subscriptions', ['client_id'])
    op.create_index('ix_webhook_subscriptions_status', 'webhook_subscriptions', ['status'])

    op.create_table(
        'webhook_deliveries',
        sa.Column('id', sa.String(length=32), primary_key=True),
        sa.Column('subscription_id', sa.String(length=32),
                  sa.ForeignKey('webhook_subscriptions.id'), nullable=False),
        sa.Column('event_id', sa.String(length=32),
                  sa.ForeignKey('api_events.id'), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('response_status', sa.Integer(), nullable=True),
        sa.Column('last_error', sa.String(length=500), nullable=True),
        sa.Column('next_attempt_at', sa.DateTime(), nullable=True),
        sa.Column('last_attempt_at', sa.DateTime(), nullable=True),
        sa.Column('delivered_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_webhook_deliveries_subscription_id', 'webhook_deliveries', ['subscription_id'])
    op.create_index('ix_webhook_deliveries_event_id', 'webhook_deliveries', ['event_id'])
    op.create_index('ix_webhook_deliveries_status', 'webhook_deliveries', ['status'])
    op.create_index('ix_webhook_deliveries_next_attempt_at', 'webhook_deliveries', ['next_attempt_at'])
    op.create_index('ix_webhook_deliveries_created_at', 'webhook_deliveries', ['created_at'])

    op.create_table(
        'api_idempotency_keys',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('scope_key', sa.String(length=200), nullable=False),
        sa.Column('idempotency_key', sa.String(length=120), nullable=False),
        sa.Column('request_hash', sa.String(length=64), nullable=False),
        sa.Column('response_status', sa.Integer(), nullable=False),
        sa.Column('response_body', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('scope_key', 'idempotency_key', name='uq_api_idem_scope_key'),
    )
    op.create_index('ix_api_idempotency_keys_scope_key', 'api_idempotency_keys', ['scope_key'])
    op.create_index('ix_api_idempotency_keys_created_at', 'api_idempotency_keys', ['created_at'])

    op.create_table(
        'api_audit_log',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('action', sa.String(length=80), nullable=False),
        sa.Column('actor_type', sa.String(length=20), nullable=False),
        sa.Column('actor_id', sa.String(length=64), nullable=True),
        sa.Column('target_type', sa.String(length=40), nullable=True),
        sa.Column('target_id', sa.String(length=64), nullable=True),
        sa.Column('request_id', sa.String(length=36), nullable=True),
        sa.Column('ip_address', sa.String(length=64), nullable=True),
        sa.Column('detail', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_api_audit_log_action', 'api_audit_log', ['action'])
    op.create_index('ix_api_audit_log_created_at', 'api_audit_log', ['created_at'])


def downgrade():
    op.drop_table('api_audit_log')
    op.drop_table('api_idempotency_keys')
    op.drop_table('webhook_deliveries')
    op.drop_table('webhook_subscriptions')
    op.drop_table('api_events')
    op.drop_table('api_keys')
    op.drop_table('api_clients')
