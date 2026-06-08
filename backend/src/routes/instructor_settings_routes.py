"""
Instructor Settings API Routes for Afritec Bridge LMS
Allows instructors to manage their personal AI provider API keys and model configurations
from their settings page — each user has their own settings stored in UserAISetting table.
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps
import logging

from ..models.user_models import db, User
from ..models.system_settings_models import (
    SystemSetting, SystemSettingsManager, UserAISetting
)
from ..services.ai.ai_providers import ai_provider_manager

logger = logging.getLogger(__name__)

# Create the blueprint
instructor_settings_bp = Blueprint(
    "instructor_settings_bp",
    __name__,
    url_prefix="/api/v1/instructor/settings",
)


def instructor_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        try:
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)

            if not user:
                return jsonify({"error": "User not found"}), 401

            if not user.role or user.role.name not in ["instructor", "admin"]:
                return jsonify({"error": "Instructor privileges required"}), 403

            return f(user, *args, **kwargs)
        except Exception as e:
            logger.error(f"Instructor authorization error: {str(e)}")
            return jsonify({"error": "Authorization failed"}), 401

    return decorated_function


# AI settings keys that instructors are allowed to view/edit
PERSONAL_AI_SETTINGS_KEYS = [
    "openrouter_api_key",
    "gemini_api_key",
    "openrouter_model_name",
    "gemini_model_name",
    "ai_agent_enabled",
    "ai_max_requests_per_day",
]


def _is_masked_value(value: str) -> bool:
    """
    Check if a value looks like a masked API key (contains '*' in the middle).
    Used to detect when the frontend sends back the masked representation unchanged.
    """
    return isinstance(value, str) and "*" in value and len(value) > 8


def _get_or_create_user_ai_settings(user_id: int) -> UserAISetting:
    """Get the user's AI settings, creating a default row if none exists."""
    settings = UserAISetting.query.filter_by(user_id=user_id).first()
    if not settings:
        settings = UserAISetting(user_id=user_id)
        db.session.add(settings)
        db.session.commit()
        logger.info(f"Created UserAISetting for user {user_id}")
    return settings


@instructor_settings_bp.route("/ai", methods=["GET"])
@instructor_required
def get_ai_settings(current_user):
    """Get the current user's personal AI provider settings (API keys are masked)."""
    try:
        user_settings = _get_or_create_user_ai_settings(current_user.id)
        masked = user_settings.to_dict(mask_keys=True)

        # Build response with metadata for each setting
        settings = {}
        for key in PERSONAL_AI_SETTINGS_KEYS:
            value = masked.get(key, "")
            # Determine if the user actually has a value set (not empty/None)
            raw_value = getattr(user_settings, key, None)
            has_value = bool(raw_value)

            settings[key] = {
                "key": key,
                "value": str(value) if value is not None else "",
                "data_type": "string" if key.endswith(("api_key", "model_name")) else ("boolean" if key == "ai_agent_enabled" else "integer"),
                "description": _get_setting_description(key),
                "is_editable": True,
                "has_value": has_value,
            }

        # Include provider health status
        provider_stats = ai_provider_manager.get_provider_stats()

        return jsonify(
            {
                "success": True,
                "data": {
                    "settings": settings,
                    "provider_stats": {
                        "openrouter": {
                            "available": provider_stats["openrouter"]["available"],
                            "failure_count": provider_stats["openrouter"]["failure_count"],
                            "is_cooling_down": provider_stats["openrouter"]["is_cooling_down"],
                            "requests_this_minute": provider_stats["openrouter"]["requests_this_minute"],
                            "rpm_limit": provider_stats["openrouter"]["rpm_limit"],
                        },
                        "gemini": {
                            "available": provider_stats["gemini"]["available"],
                            "failure_count": provider_stats["gemini"]["failure_count"],
                            "is_cooling_down": provider_stats["gemini"]["is_cooling_down"],
                            "requests_this_minute": provider_stats["gemini"]["requests_this_minute"],
                            "rpm_limit": provider_stats["gemini"]["rpm_limit"],
                        },
                        "current_provider": provider_stats["current_provider"],
                    },
                },
            }
        ), 200

    except Exception as e:
        logger.error(f"Error fetching user AI settings: {str(e)}")
        return jsonify({"success": False, "error": "Failed to fetch AI settings"}), 500


@instructor_settings_bp.route("/ai", methods=["PUT"])
@instructor_required
def update_ai_settings(current_user):
    """Update the current user's personal AI provider settings."""
    try:
        data = request.get_json()
        if not data or "settings" not in data:
            return jsonify({"error": "No settings data provided"}), 400

        settings_data = data["settings"]
        user_settings = _get_or_create_user_ai_settings(current_user.id)

        # Filter to allowed keys only and update
        filtered_data = {}
        for key, value in settings_data.items():
            if key not in PERSONAL_AI_SETTINGS_KEYS:
                logger.warning(f"Ignoring setting '{key}' — not in allowed list")
                continue

            # If masked API key value (unchanged), skip
            if key in ("openrouter_api_key", "gemini_api_key") and _is_masked_value(str(value)):
                logger.info(f"Skipping {key} — masked (unchanged)")
                continue

            # Convert types appropriately
            if key == "ai_agent_enabled":
                filtered_data[key] = str(value).lower() in ("true", "1", "yes")
            elif key == "ai_max_requests_per_day":
                filtered_data[key] = int(value) if value else 100
            else:
                filtered_data[key] = str(value) if value is not None else ""

            logger.info(f"Updating {key} for user {current_user.id}")

        if not filtered_data:
            return jsonify({"success": True, "message": "No changes to save", "data": {"updated": [], "errors": []}}), 200

        updated_keys = user_settings.update_from_dict(filtered_data, mask_check=True)
        db.session.commit()

        # Activate this user's keys so subsequent AI requests use their settings
        ai_provider_manager.set_active_user(current_user.id)

        return jsonify(
            {
                "success": True,
                "message": f"Updated {len(updated_keys)} setting(s)",
                "data": {"updated": updated_keys, "errors": []},
            }
        ), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating user AI settings: {str(e)}")
        return jsonify({"success": False, "error": "Failed to update settings"}), 500


@instructor_settings_bp.route("/ai/test", methods=["POST"])
@instructor_required
def test_ai_connection(current_user):
    """Test the AI provider connection using the current user's API keys."""
    try:
        data = request.get_json() or {}
        provider = data.get("provider", "openrouter")

        if provider not in ("openrouter", "gemini"):
            return jsonify({"error": "Invalid provider. Use 'openrouter' or 'gemini'"}), 400

        # Ensure the user's context is active for this test
        ai_provider_manager.set_active_user(current_user.id)

        if provider == "openrouter" and not ai_provider_manager.openrouter_api_key:
            return jsonify({"success": False, "message": "OpenRouter API key is not configured"}), 400

        if provider == "gemini" and not ai_provider_manager.gemini_api_key:
            return jsonify({"success": False, "message": "Gemini API key is not configured"}), 400

        # Make a minimal test request
        test_prompt = "Respond with only the word 'OK' if you receive this message."
        result, used_provider = ai_provider_manager.make_ai_request(
            test_prompt,
            temperature=0.1,
            max_tokens=10,
            prefer_fast=True,
        )

        if result:
            return jsonify(
                {
                    "success": True,
                    "message": f"Connection successful via {used_provider}",
                    "provider_used": used_provider,
                    "response": result.strip(),
                }
            ), 200
        else:
            return jsonify(
                {
                    "success": False,
                    "message": f"Provider {provider} returned no response",
                    "provider_used": used_provider,
                }
            ), 502

    except Exception as e:
        logger.error(f"Error testing AI connection: {str(e)}")
        return jsonify({"success": False, "message": f"Connection failed: {str(e)}"}), 500


@instructor_settings_bp.route("/ai/activate", methods=["POST"])
@instructor_required
def activate_ai_context(current_user):
    """
    Explicitly activate the current user's personal AI provider context.
    
    This loads the user's API keys and model names into the AI provider manager
    so subsequent AI requests (content generation, quizzes, etc.) use the user's
    own credentials. Useful on login or when navigating to the AI generation pages.
    
    Returns the current provider status and active user info.
    """
    try:
        user_settings = _get_or_create_user_ai_settings(current_user.id)

        # Activate the user's context in the provider manager
        ai_provider_manager.set_active_user(current_user.id)

        provider_stats = ai_provider_manager.get_provider_stats()

        has_personal_keys = bool(
            user_settings.openrouter_api_key or user_settings.gemini_api_key
        )

        return jsonify(
            {
                "success": True,
                "message": f"AI provider context activated for user {current_user.id}",
                "data": {
                    "active_user_id": current_user.id,
                    "has_personal_keys": has_personal_keys,
                    "active_provider": provider_stats.get("current_provider"),
                    "provider_stats": {
                        "openrouter": {
                            "available": provider_stats["openrouter"]["available"],
                            "failure_count": provider_stats["openrouter"]["failure_count"],
                            "is_cooling_down": provider_stats["openrouter"]["is_cooling_down"],
                            "requests_this_minute": provider_stats["openrouter"]["requests_this_minute"],
                            "rpm_limit": provider_stats["openrouter"]["rpm_limit"],
                        },
                        "gemini": {
                            "available": provider_stats["gemini"]["available"],
                            "failure_count": provider_stats["gemini"]["failure_count"],
                            "is_cooling_down": provider_stats["gemini"]["is_cooling_down"],
                            "requests_this_minute": provider_stats["gemini"]["requests_this_minute"],
                            "rpm_limit": provider_stats["gemini"]["rpm_limit"],
                        },
                    },
                    "model_names": {
                        "openrouter_model_name": user_settings.openrouter_model_name or "",
                        "gemini_model_name": user_settings.gemini_model_name or "",
                    },
                },
            }
        ), 200

    except Exception as e:
        logger.error(f"Error activating AI context: {str(e)}")
        return jsonify({"success": False, "error": "Failed to activate AI context"}), 500


def _get_setting_description(key: str) -> str:
    """Get a human-readable description for each setting key."""
    descriptions = {
        "openrouter_api_key": "OpenRouter API key for AI content generation (your personal key)",
        "gemini_api_key": "Gemini API key for AI content generation (your personal key)",
        "openrouter_model_name": "OpenRouter model name used for AI content generation",
        "gemini_model_name": "Gemini model name used for AI content generation",
        "ai_agent_enabled": "Enable AI-powered content generation features",
        "ai_max_requests_per_day": "Maximum AI requests per day (per user)",
    }
    return descriptions.get(key, "")
