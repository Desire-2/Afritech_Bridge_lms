#!/usr/bin/env python3
"""
⏰ Payment Reminder Scheduler - Command Line Tool

Run scheduled payment reminders for draft applications with pending payments.
Can be run manually or scheduled via cron job.

Usage:
    python run_payment_reminders.py [options]

Options:
    --dry-run          : Preview which applications would get reminders (no emails sent)
    --force            : Send reminders even if recently sent (override 24h cooldown)
    --application-id ID: Send reminder to specific application only
    --verbose          : Enable detailed logging

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


def run_scheduler(dry_run=False, force=False, verbose=False):
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
        logger.info("=" * 80)
        
        try:
            # Run scheduler
            result = PaymentReminderScheduler.run_scheduler(dry_run=dry_run)
            
            # Log results
            logger.info("\n" + "=" * 80)
            logger.info("📊 SCHEDULER SUMMARY")
            logger.info("=" * 80)
            logger.info(f"Status: {result.get('status', 'unknown').upper()}")
            logger.info(f"Total Checked: {result.get('total_checked', 0)}")
            logger.info(f"Reminders Needed: {result.get('reminders_needed', 0)}")
            
            if not dry_run:
                logger.info(f"✅ Sent Successfully: {result.get('sent', 0)}")
                logger.info(f"❌ Failed: {result.get('failed', 0)}")
                logger.info(f"⏭️ Skipped: {result.get('skipped', 0)}")
            
            logger.info(f"⏱️ Duration: {result.get('duration_seconds', 0):.2f} seconds")
            
            if result.get('errors'):
                logger.info(f"\n⚠️ ERRORS ({len(result['errors'])}):")
                for error in result['errors'][:10]:  # Show first 10 errors
                    logger.error(
                        f"   Application #{error.get('application_id')} "
                        f"({error.get('email')}): {error.get('error')}"
                    )
            
            if dry_run and result.get('applications'):
                logger.info(f"\n📋 APPLICATIONS TO REMIND ({len(result['applications'])}):")
                for app in result['applications'][:20]:  # Show first 20
                    logger.info(
                        f"   #{app['application_id']} - {app['email']} - "
                        f"{app['course']} - {app['days_remaining']} days - "
                        f"{app['reminder_type']} reminder"
                    )
            
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
            # Run full scheduler
            success = run_scheduler(
                dry_run=args.dry_run,
                force=args.force,
                verbose=args.verbose
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
