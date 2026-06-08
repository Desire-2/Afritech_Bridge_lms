"""
End-to-end test for per-user AI instructor settings.
Creates test users with known passwords, then tests GET/PUT/test endpoints.

Usage: venv/bin/python test_instructor_ai_settings.py
"""

import requests
import json
import sys
import os

BASE_URL = "http://localhost:5001/api/v1"
VERBOSE = True

# Add backend to path for DB access
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from main import app as flask_app
from src.models.user_models import db, User, Role

def log(msg):
    if VERBOSE:
        print(msg)

def print_response(prefix, resp):
    try:
        data = resp.json()
        log(f"  {prefix} [{resp.status_code}]: {json.dumps(data, indent=2)[:600]}")
    except:
        log(f"  {prefix} [{resp.status_code}]: {resp.text[:200]}")
    return resp


def create_test_users():
    """Create two test users with known passwords for the test."""
    users = {}
    with flask_app.app_context():
        instructor_role = Role.query.filter_by(name='instructor').first()
        admin_role = Role.query.filter_by(name='admin').first()

        for uname, email, role_obj in [
            ("e2e_instructor_1", "e2e_instructor1@test.com", instructor_role),
            ("e2e_instructor_2", "e2e_instructor2@test.com", instructor_role),
        ]:
            existing = User.query.filter_by(username=uname).first()
            if existing:
                existing.set_password("TestPass123!")
                db.session.commit()
                users[uname] = existing
                log(f"  🔄 Updated password for existing user '{uname}' (ID={existing.id})")
            else:
                user = User(
                    username=uname,
                    email=email,
                    first_name="E2E",
                    last_name="Tester",
                    role_id=role_obj.id,
                )
                user.set_password("TestPass123!")
                db.session.add(user)
                db.session.commit()
                users[uname] = user
                log(f"  ✅ Created test user '{uname}' (ID={user.id})")
    return users


def cleanup_test_users(users):
    """Clean up test users after the test."""
    with flask_app.app_context():
        for uname, user in users.items():
            # Also clean up their UserAISetting
            from src.models.system_settings_models import UserAISetting
            ai_setting = UserAISetting.query.filter_by(user_id=user.id).first()
            if ai_setting:
                db.session.delete(ai_setting)
                log(f"  🗑️  Deleted UserAISetting for user {user.id}")
            db.session.delete(user)
            db.session.commit()
            log(f"  🗑️  Deleted test user '{uname}' (ID={user.id})")


def login(identifier, password):
    log(f"\n{'='*60}")
    log(f"📌 LOGIN as '{identifier}'")
    log(f"{'='*60}")
    resp = requests.post(
        f"{BASE_URL}/auth/login",
        json={"identifier": identifier, "password": password},
        timeout=10,
    )
    print_response("Login", resp)
    if resp.status_code == 200:
        data = resp.json()
        token = data.get("access_token")
        log(f"  ✅ Token obtained: {token[:30]}...")
        return token
    log(f"  ❌ Login failed")
    return None


def get_ai_settings(token, label="GET AI settings"):
    log(f"\n  ── {label} ──")
    resp = requests.get(
        f"{BASE_URL}/instructor/settings/ai",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    print_response("GET", resp)
    if resp.status_code == 200:
        data = resp.json()
        settings = data.get("data", {}).get("settings", {})
        stats = data.get("data", {}).get("provider_stats", {})
        log(f"\n  ✅ {len(settings)} setting keys returned: {list(settings.keys())}")
        for key, item in settings.items():
            val = item.get("value", "")
            log(f"     {key}: {'<masked>' if '*' in str(val) else repr(val)[:50]}")
        return data
    return None


def put_ai_settings(token, settings, label="PUT AI settings"):
    log(f"\n  ── {label} ──")
    resp = requests.put(
        f"{BASE_URL}/instructor/settings/ai",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={"settings": settings},
        timeout=10,
    )
    print_response("PUT", resp)
    return resp


def test_ai_connection(token, provider, label="Test connection"):
    log(f"\n  ── {label} ({provider}) ──")
    resp = requests.post(
        f"{BASE_URL}/instructor/settings/ai/test",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={"provider": provider},
        timeout=30,
    )
    print_response("POST", resp)
    return resp


def run_tests():
    log("\n" + "=" * 60)
    log("🧪 INSTRUCTOR AI SETTINGS — END-TO-END TEST")
    log("=" * 60)

    # ── Setup: Create test users ──
    log(f"\n📌 Setting up test users...")
    users = create_test_users()
    user1 = users.get("e2e_instructor_1")
    user2 = users.get("e2e_instructor_2")
    assert user1 and user2, "Failed to create test users"

    passed = 0
    failed = 0

    def check(condition, msg):
        nonlocal passed, failed
        if condition:
            log(f"  ✅ {msg}")
            passed += 1
        else:
            log(f"  ❌ {msg}")
            failed += 1

    # ── Step 1: Login as User 1 ──
    token1 = login("e2e_instructor_1", "TestPass123!")
    check(token1 is not None, "User 1 login successful")
    if not token1:
        log("  Cannot proceed without auth token")
        return

    # ── Step 2: GET without auth (should fail) ──
    log(f"\n{'='*60}")
    log("📌 TEST: Unauthenticated GET → expect 401")
    log(f"{'='*60}")
    resp = requests.get(f"{BASE_URL}/instructor/settings/ai", timeout=10)
    check(resp.status_code in (401, 403), "Unauthenticated request correctly rejected")

    # ── Step 3: GET initial settings (should be empty/default) ──
    log(f"\n{'='*60}")
    log("📌 TEST: GET initial per-user settings")
    log(f"{'='*60}")
    data1 = get_ai_settings(token1, "User 1 — initial GET")
    check(data1 is not None, "GET returns data")
    if data1:
        settings = data1.get("data", {}).get("settings", {})
        check("openrouter_api_key" in settings, "openrouter_api_key present")
        check("gemini_api_key" in settings, "gemini_api_key present")
        check("openrouter_model_name" in settings, "openrouter_model_name present")
        check("gemini_model_name" in settings, "gemini_model_name present")
        check("ai_agent_enabled" in settings, "ai_agent_enabled present")
        check("ai_max_requests_per_day" in settings, "ai_max_requests_per_day present")
        check(len(settings) == 6, f"All 6 settings present (got {len(settings)})")

    # ── Step 4: PUT model names ──
    log(f"\n{'='*60}")
    log("📌 TEST: PUT model names (per-user)")
    log(f"{'='*60}")
    resp = put_ai_settings(token1, {
        "openrouter_model_name": "user1-custom-openrouter-model",
        "gemini_model_name": "user1-custom-gemini-model",
    }, "Save model names for User 1")
    check(resp.status_code == 200, "Model names saved (200)")

    # Verify
    data1b = get_ai_settings(token1, "User 1 — verify model names")
    if data1b:
        s = data1b.get("data", {}).get("settings", {})
        or_model = s.get("openrouter_model_name", {}).get("value", "")
        gem_model = s.get("gemini_model_name", {}).get("value", "")
        check(or_model == "user1-custom-openrouter-model",
              f"OpenRouter model name persisted: '{or_model}'")
        check(gem_model == "user1-custom-gemini-model",
              f"Gemini model name persisted: '{gem_model}'")

    # ── Step 5: PUT API keys ──
    log(f"\n{'='*60}")
    log("📌 TEST: PUT API keys → GET returns masked")
    log(f"{'='*60}")
    resp = put_ai_settings(token1, {
        "openrouter_api_key": "sk-test-key-1234567890",
        "gemini_api_key": "AIza-test-key-1234567890",
    }, "Save API keys for User 1")
    check(resp.status_code == 200, "API keys saved (200)")

    data1c = get_ai_settings(token1, "User 1 — verify keys masked")
    if data1c:
        s = data1c.get("data", {}).get("settings", {})
        or_key = s.get("openrouter_api_key", {}).get("value", "")
        gem_key = s.get("gemini_api_key", {}).get("value", "")
        check("*" in str(or_key), f"OpenRouter key masked: '{or_key[:10]}...'")
        check("*" in str(gem_key), f"Gemini key masked: '{gem_key[:10]}...'")
        check(or_key != "sk-test-key-1234567890", "OpenRouter key NOT returned in plaintext")
        check(gem_key != "AIza-test-key-1234567890", "Gemini key NOT returned in plaintext")

    # ── Step 6: PUT with masked value (unchanged) ──
    log(f"\n{'='*60}")
    log("📌 TEST: PUT with masked API key → should skip")
    log(f"{'='*60}")
    resp = put_ai_settings(token1, {
        "openrouter_api_key": "sk-t****...****7890",
    }, "Send masked value (unchanged)")
    check(resp.status_code == 200, "Masked value correctly accepted")

    # ── Step 7: Test connection endpoint ──
    log(f"\n{'='*60}")
    log("📌 TEST: POST test connection endpoint")
    log(f"{'='*60}")
    resp = test_ai_connection(token1, "openrouter", "Test OpenRouter")
    # With fake keys, expect 400 or 502 — that's fine, endpoint works
    check(resp.status_code in (200, 400, 502),
          f"Connection test endpoint responds ({resp.status_code})")

    # ── Step 8: Per-user isolation ──
    log(f"\n{'='*60}")
    log("📌 TEST: Per-user setting isolation")
    log(f"{'='*60}")
    token2 = login("e2e_instructor_2", "TestPass123!")
    check(token2 is not None, "User 2 login successful")

    if token2:
        data2 = get_ai_settings(token2, "User 2 — GET settings")
        if data2:
            s2 = data2.get("data", {}).get("settings", {})
            or_model_2 = s2.get("openrouter_model_name", {}).get("value", "")
            check(or_model_2 != "user1-custom-openrouter-model",
                  f"User 2 does NOT see User 1's model name (got '{or_model_2}')")
            check(or_model_2 == "", "User 2's settings are empty/default")

        # Save different model for User 2
        resp = put_ai_settings(token2, {
            "openrouter_model_name": "user2-custom-model",
        }, "User 2 — save model")
        check(resp.status_code == 200, "User 2 model name saved")

        # Verify User 1 still has their value
        data1d = get_ai_settings(token1, "User 1 — verify unchanged after User 2")
        if data1d:
            s1d = data1d.get("data", {}).get("settings", {})
            or_model_1d = s1d.get("openrouter_model_name", {}).get("value", "")
            check(or_model_1d == "user1-custom-openrouter-model",
                  f"User 1's model preserved ('{or_model_1d}')")

    # ── Results ──
    log(f"\n{'='*60}")
    log(f"📋 TEST RESULTS: {passed} passed, {failed} failed")
    log(f"{'='*60}")

    if failed > 0:
        log("\n⚠️  Some tests failed — see details above.")

    # ── Cleanup ──
    log(f"\n📌 Cleaning up test users...")
    cleanup_test_users(users)

    return failed == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
