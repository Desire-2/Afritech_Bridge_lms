"""
One-time DB migration: Update stale Gemini model names in both SystemSetting
and UserAISetting tables to the current equivalent.

This migrates any records holding old/deprecated model names (like
'gemini-2.5-flash-preview-09-2025') to the current stable model
('gemini-2.0-flash').

Safe to run multiple times — checks current value before updating.

Usage:
    cd backend
    venv/bin/python migrate_gemini_model_name.py
"""

import sys
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Mapping of stale Gemini model names → current equivalents.
# Must match the STALE_GEMINI_MODELS dict in src/services/ai/ai_providers.py.
STALE_GEMINI_MODELS = {
    'gemini-2.5-flash-preview-09-2025': 'gemini-2.0-flash',
    'gemini-2.5-pro-preview-03-2025': 'gemini-2.0-pro',
    'gemini-2.0-flash-exp': 'gemini-2.0-flash',
}


def run_migration():
    """Connect to the DB, find stale model names, and update them."""
    try:
        from main import app as flask_app
    except ImportError:
        logger.error(
            "Could not import Flask app from main.py. "
            "Run this script from the backend/ directory."
        )
        sys.exit(1)

    with flask_app.app_context():
        from src.models.system_settings_models import (
            SystemSetting,
            UserAISetting,
            SystemSettingsManager,
        )
        from src.models.user_models import db

        total_updated = 0

        # --- 1. Migrate SystemSetting (global AI model name) ---
        logger.info("Checking SystemSetting table for stale gemini_model_name...")
        global_records = SystemSetting.query.filter_by(key='gemini_model_name').all()
        for setting in global_records:
            old_val = setting.value
            new_val = STALE_GEMINI_MODELS.get(old_val)
            if new_val:
                setting.value = new_val
                setting.updated_at = datetime.utcnow()
                db.session.add(setting)
                logger.info(
                    f"  ✅ SystemSetting gemini_model_name: "
                    f"'{old_val}' → '{new_val}'"
                )
                total_updated += 1
            else:
                logger.info(
                    f"  ℹ️  SystemSetting gemini_model_name = "
                    f"'{old_val}' — not stale, skipping"
                )

        # --- 2. Migrate UserAISetting (per-user model names) ---
        logger.info("Checking UserAISetting table for stale gemini_model_name...")
        user_records = UserAISetting.query.all()
        for us in user_records:
            old_val = us.gemini_model_name
            if not old_val:
                continue
            new_val = STALE_GEMINI_MODELS.get(old_val)
            if new_val:
                us.gemini_model_name = new_val
                us.updated_at = datetime.utcnow()
                db.session.add(us)
                logger.info(
                    f"  ✅ UserAISetting (user_id={us.user_id}): "
                    f"'{old_val}' → '{new_val}'"
                )
                total_updated += 1
            else:
                logger.info(
                    f"  ℹ️  UserAISetting (user_id={us.user_id}): "
                    f"gemini_model_name = '{old_val}' — not stale, skipping"
                )

        # --- 3. Commit ---
        if total_updated > 0:
            try:
                db.session.commit()
                logger.info(
                    f"\n✅ Migration complete: {total_updated} record(s) updated."
                )
            except Exception as e:
                db.session.rollback()
                logger.error(f"Migration failed during commit: {e}")
                sys.exit(1)

            # Clear the SystemSettingsManager cache so the new value is picked
            # up immediately by reload_config() / the AI provider manager.
            SystemSettingsManager.clear_cache()
            logger.info("  ✅ SystemSettingsManager cache cleared.")
        else:
            logger.info("\nℹ️  No stale model names found — nothing to update.")

        # --- 4. Summary ---
        print("\n" + "=" * 60)
        print("MIGRATION SUMMARY")
        print("=" * 60)
        print(f"  Records updated:           {total_updated}")
        print(f"  Global settings checked:   {len(global_records)}")
        print(f"  Per-user settings checked: {len(user_records)}")
        print(f"\n  Stale names migrated:")
        for stale, replacement in STALE_GEMINI_MODELS.items():
            print(f"    {stale}  →  {replacement}")
        print("=" * 60)


if __name__ == "__main__":
    run_migration()
