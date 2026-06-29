#!/usr/bin/env python3
"""
⏰ Payment Reminder Scheduler - Command Line Tool

Run scheduled payment reminders for all applicants who have not completed payment.
Now supports three categories:

Category A: Draft applications with pending payment
Category B: Submitted applications where payment is not yet approved
           (tells them to send proof on WhatsApp or pay now)
Category C: Students migrated between cohorts with pending payment
           (tells them to login and pay affordable price)

Usage:
    python run_payment_reminders.py [options]

Options:
    --dry-run                  : Preview which reminders would be sent (no emails sent)
    --force                    : Send reminders even if recently sent (override cooldown)
    --application-id ID        : Send reminder to specific application only
    --category [drafts|submitted_unapproved|pending_enrollments|all]
                               : Which category(ies) to process (default: all)
    --verbose                  : Enable detailed logging

Cron Job Example (run daily at 9 AM):
    0 9 * * * cd /path/to/backend && python run_payment_reminders.py >> logs/payment_reminders.log 2>&1
"""
import sys
import os
import argparse
import logging
from datetime import datetime, timezone

# Add src directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

# Ensure logs directory exists
logs_dir = os.path.join(os.path.dirname(__file__), 'logs')
if not os.path.exists(logs_dir):
    os.makedirs(logs_dir)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(logs_dir, 'payment_reminders.log'), mode='a')
    ]
)
logger = logging.getLogger(__name__)


def run_scheduler(dry_run=False, force=False, verbose=False, categories=None):
    """Run the automated payment reminder scheduler"""
    from flask import Flask
    from src.models.user_models import db
    from src.services.payment_reminder_scheduler import PaymentReminderScheduler

    # Create Flask app context
    app = Flask(__name__)

    # Get database URL from environment or use SQLite default with absolute path
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        # Use absolute path for SQLite (matches main.py logic)
        db_path = os.path.join(os.path.dirname(__file__), 'instance', 'afritec_lms_db.db')
        database_url = f"sqlite:///{db_path}"

        # Ensure instance directory exists
        instance_dir = os.path.dirname(db_path)
        if not os.path.exists(instance_dir):
            os.makedirs(instance_dir)

    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Transform postgres:// to postgresql+psycopg2:// for SQLAlchemy 2.0
    if app.config['SQLALCHEMY_DATABASE_URI'].startswith('postgres://'):
        app.config['SQLALCHEMY_DATABASE_URI'] = app.config['SQLALCHEMY_DATABASE_URI'].replace(
            'postgres://', 'postgresql+psycopg2://', 1
        )

    db.init_app(app)

    with app.app_context():
        logger.info("=" * 80)
        logger.info(f"🚀 Payment Reminder Scheduler Started - {datetime.now(timezone.utc).isoformat()}")
        logger.info(f"   Mode: {'DRY RUN' if dry_run else 'LIVE'}")
        logger.info(f"   Force: {force}")
        logger.info(f"   Categories: {categories or 'all'}")
        logger.info("=" * 80)

        try:
            # Run scheduler with category filter
            result = PaymentReminderScheduler.run_scheduler(
                dry_run=dry_run,
                categories=categories
            )

            # Log results
            logger.info("\n" + "=" * 80)
            logger.info("📊 SCHEDULER SUMMARY")
            logger.info("=" * 80)
            logger.info(f"Status: {result.get('status', 'unknown').upper()}")

            for cat_name, cat_result in result.get('category_results', {}).items():
                logger.info(f"\n  📁 Category: {cat_name}")
                if dry_run:
                    reminders = cat_result.get('reminders_needed', 0)
                    logger.info(f"     Reminders needed: {reminders}")
                    if reminders > 0 and cat_result.get('applications'):
                        for app_info in cat_result['applications'][:10]:
                            logger.info(
                                f"       • #{app_info.get('application_id', app_info.get('enrollment_id', 'N/A'))} "
                                f"- {app_info.get('email', 'N/A')} - {app_info.get('course', 'N/A')}"
                            )
                else:
                    logger.info(f"     Total: {cat_result.get('total', 0)}")
                    logger.info(f"     ✅ Sent: {cat_result.get('sent', 0)}")
                    logger.info(f"     ❌ Failed: {cat_result.get('failed', 0)}")

            if not dry_run:
                total_sent = sum(
                    r.get('sent', 0) for r in result.get('category_results', {}).values()
                )
                total_failed = sum(
                    r.get('failed', 0) for r in result.get('category_results', {}).values()
                )
                logger.info(f"\n  📊 TOTAL: {total_sent} sent, {total_failed} failed")

            logger.info(f"\n⏱️ Duration: {result.get('duration_seconds', 0):.2f} seconds")
            logger.info("=" * 80)
            logger.info(f"✅ Payment Reminder Scheduler Completed - {datetime.now(timezone.utc).isoformat()}")
            logger.info("=" * 80 + "\n")

            return result.get('status') == 'success'

        except Exception as e:
            logger.error("=" * 80)
            logger.error(f"❌ Scheduler Failed: {str(e)}")
            logger.error("=" * 80)
            import traceback
            traceback.print_exc()
            return False


def send_single_reminder(application_id):
    """Send reminder to a specific application"""
    from flask import Flask
    from src.models.user_models import db
    from src.services.payment_reminder_scheduler import PaymentReminderScheduler

    # Create Flask app context
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
        'DATABASE_URL',
        'sqlite:///instance/afritec_lms_db.db'
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    if app.config['SQLALCHEMY_DATABASE_URI'].startswith('postgres://'):
        app.config['SQLALCHEMY_DATABASE_URI'] = app.config['SQLALCHEMY_DATABASE_URI'].replace(
            'postgres://', 'postgresql+psycopg2://', 1
        )

    db.init_app(app)

    with app.app_context():
        logger.info(f"📧 Sending payment reminder to application #{application_id}")

        result = PaymentReminderScheduler.send_single_reminder(application_id)

        if result.get('status') == 'success':
            logger.info(f"✅ {result.get('message')}")
            return True
        else:
            logger.error(f"❌ Failed: {result.get('error')}")
            return False


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Automated Payment Reminder Scheduler',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview which applications would get reminders (no emails sent)'
    )

    parser.add_argument(
        '--force',
        action='store_true',
        help='Send reminders even if recently sent (override 24h cooldown)'
    )

    parser.add_argument(
        '--application-id',
        type=int,
        metavar='ID',
        help='Send reminder to specific application only'
    )

    parser.add_argument(
        '--category',
        type=str,
        default='all',
        choices=['drafts', 'submitted_unapproved', 'pending_enrollments', 'all'],
        help='Which category of reminders to process (default: all)'
    )

    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable detailed logging'
    )

    args = parser.parse_args()

    # Set logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Ensure logs directory exists
    os.makedirs('logs', exist_ok=True)

    try:
        if args.application_id:
            # Send single reminder
            success = send_single_reminder(args.application_id)
        else:
            # Determine categories
            categories_map = {
                'drafts': ['drafts'],
                'submitted_unapproved': ['submitted_unapproved'],
                'pending_enrollments': ['pending_enrollments'],
                'all': None,  # None means all categories
            }
            categories = categories_map.get(args.category)

            # Run full scheduler
            success = run_scheduler(
                dry_run=args.dry_run,
                force=args.force,
                verbose=args.verbose,
                categories=categories
            )

        sys.exit(0 if success else 1)

    except KeyboardInterrupt:
        logger.info("\n⚠️ Scheduler interrupted by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"❌ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
