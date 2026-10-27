"""Payment-settings consistency across course, cohort and admin paths.

S-1  PUT with only boolean toggles recomputes the authoritative
     payment_methods JSON (stripe preserved — it has no boolean column)
S-2  PUT with an explicit payment_methods array is respected as-is
S-3  POST /admin/courses persists payment fields (regression: category_id
     TypeError used to 500 every admin course creation)
S-4  POST /courses persists difficulty_level/thumbnail_url sent by the
     admin course form
"""
import hashlib
import json
import uuid

import pytest
from flask_jwt_extended import create_access_token


@pytest.fixture()
def users(app):
    from src.models.user_models import db, User, Role

    db.create_all()
    made = {}
    for name in ("admin", "instructor"):
        role = Role.query.filter_by(name=name).first()
        if role is None:
            role = Role(name=name)
            db.session.add(role)
            db.session.flush()
        tag = uuid.uuid4().hex[:8]
        user = User(
            username=f"pay_{name}_{tag}",
            email=f"pay_{name}_{tag}@afritech.test",
            password_hash=hashlib.sha256(b"x").hexdigest(),
            role_id=role.id,
        )
        db.session.add(user)
        db.session.commit()
        db.session.refresh(user)
        made[name] = user
    return made


def _headers(app, user):
    with app.app_context():
        token = create_access_token(identity=str(user.id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def course(app, users):
    from src.models.course_models import db, Course

    course = Course(
        title=f"PM Course {uuid.uuid4().hex[:8]}",
        description="payment settings fixture",
        instructor_id=users["instructor"].id,
        enrollment_type="paid",
        price=100.0,
        payment_methods=json.dumps(["paypal", "stripe", "kpay"]),
        paypal_enabled=True,
        mobile_money_enabled=False,
        bank_transfer_enabled=False,
        kpay_enabled=True,
        flutterwave_enabled=False,
        momo_pay_code_enabled=False,
    )
    db.session.add(course)
    db.session.commit()
    db.session.refresh(course)
    return course


def test_s1_boolean_only_put_recomputes_json(app, client, users, course):
    course_id = course.id  # fixture instance detaches after the request
    resp = client.put(
        f"/api/v1/courses/{course_id}",
        json={"kpay_enabled": False},
        headers=_headers(app, users["admin"]),
    )
    assert resp.status_code == 200

    from src.models.course_models import Course

    updated = Course.query.get(course_id)
    assert json.loads(updated.payment_methods) == ["paypal", "stripe"]
    assert updated._get_payment_methods() == ["paypal", "stripe"]


def test_s2_explicit_payment_methods_put_respected(app, client, users, course):
    course_id = course.id  # fixture instance detaches after the request
    resp = client.put(
        f"/api/v1/courses/{course_id}",
        json={"payment_methods": ["momo_pay_code"], "kpay_enabled": True},
        headers=_headers(app, users["admin"]),
    )
    assert resp.status_code == 200

    from src.models.course_models import Course

    updated = Course.query.get(course_id)
    assert json.loads(updated.payment_methods) == ["momo_pay_code"]


def test_s3_admin_create_persists_payment_fields(app, client, users):
    title = f"Admin Created {uuid.uuid4().hex[:8]}"
    resp = client.post(
        "/api/v1/admin/courses",
        json={
            "title": title,
            "description": "created by admin test",
            "instructor_id": users["instructor"].id,
            "enrollment_type": "paid",
            "price": 49.5,
            "currency": "USD",
            "payment_mode": "partial",
            "partial_payment_percentage": 40,
            "payment_methods": ["kpay", "paypal"],
            "kpay_enabled": True,
            "paypal_enabled": True,
            "mobile_money_enabled": False,
            "momo_pay_code_enabled": True,
            "installment_enabled": True,
            "installment_count": 3,
        },
        headers=_headers(app, users["admin"]),
    )
    assert resp.status_code == 201, resp.get_json()

    from src.models.course_models import Course

    created = Course.query.filter_by(title=title).first()
    assert created is not None
    assert created.price == 49.5
    assert created.payment_mode == "partial"
    assert json.loads(created.payment_methods) == ["kpay", "paypal"]
    assert created.momo_pay_code_enabled is True
    assert created.installment_count == 3


def test_g0_no_default_method_resurrected_when_nothing_enabled(app, users):
    """If every enabled method is switched off, _get_payment_methods must NOT
    resurrect a hardcoded 'kpay' default — the application form used to
    display that default to applicants even though it was not enabled."""
    from src.models.user_models import db
    from src.models.course_models import Course

    course = Course(
        title=f"No Methods {uuid.uuid4().hex[:8]}",
        description="nothing enabled",
        instructor_id=users["instructor"].id,
        enrollment_type="paid",
        price=10.0,
        payment_methods=None,
        kpay_enabled=False,
        paypal_enabled=False,
        mobile_money_enabled=False,
        bank_transfer_enabled=False,
        flutterwave_enabled=False,
        momo_pay_code_enabled=False,
    )
    db.session.add(course)
    db.session.commit()
    course_id = course.id

    assert course._get_payment_methods() == []


def test_g1_application_momo_initiate_honours_cohort_override(app, client, users):
    """A cohort payment_methods override must enable/disable momo_pay_code on
    its own — the check must not rely on the course's momo_pay_code boolean."""
    from src.models.user_models import db
    from src.models.course_models import Course, ApplicationWindow

    course = Course(
        title=f"Momo Cohort {uuid.uuid4().hex[:8]}",
        description="cohort momo override test",
        instructor_id=users["instructor"].id,
        enrollment_type="paid",
        price=80.0,
        payment_methods=json.dumps(["paypal"]),
        paypal_enabled=True,
        mobile_money_enabled=False,
        bank_transfer_enabled=False,
        kpay_enabled=False,
        flutterwave_enabled=False,
        momo_pay_code_enabled=False,
        momo_ussd_code="*182*1*123456#",
    )
    db.session.add(course)
    db.session.flush()
    window = ApplicationWindow(
        course_id=course.id,
        cohort_label="Cohort A",
        payment_methods=json.dumps(["momo_pay_code"]),
    )
    db.session.add(window)
    db.session.commit()
    course_id, window_id = course.id, window.id

    resp = client.post(
        "/api/v1/applications/initiate-payment",
        json={
            "course_id": course_id,
            "payment_method": "momo_pay_code",
            "amount": 80.0,
            "currency": "USD",
            "application_window_id": window_id,
        },
    )
    assert resp.status_code == 200, resp.get_json()
    body = resp.get_json()
    assert body["payment_method"] == "momo_pay_code"
    assert body["ussd_code"] == "*182*1*123456#"


def test_g2_application_momo_initiate_blocked_by_cohort_override(app, client, users):
    """When the cohort override excludes momo_pay_code it must be rejected
    even if the course-level boolean is still on."""
    from src.models.user_models import db
    from src.models.course_models import Course, ApplicationWindow

    course = Course(
        title=f"Momo Blocked {uuid.uuid4().hex[:8]}",
        description="cohort momo blocked test",
        instructor_id=users["instructor"].id,
        enrollment_type="paid",
        price=80.0,
        payment_methods=json.dumps(["paypal", "momo_pay_code"]),
        paypal_enabled=True,
        mobile_money_enabled=False,
        bank_transfer_enabled=False,
        kpay_enabled=True,
        flutterwave_enabled=False,
        momo_pay_code_enabled=True,
        momo_ussd_code="*182*1*123456#",
    )
    db.session.add(course)
    db.session.flush()
    window = ApplicationWindow(
        course_id=course.id,
        cohort_label="Cohort B",
        payment_methods=json.dumps(["paypal"]),
    )
    db.session.add(window)
    db.session.commit()
    course_id, window_id = course.id, window.id

    resp = client.post(
        "/api/v1/applications/initiate-payment",
        json={
            "course_id": course_id,
            "payment_method": "momo_pay_code",
            "amount": 80.0,
            "currency": "USD",
            "application_window_id": window_id,
        },
    )
    assert resp.status_code == 400
    db.session.expire_all()
    assert Course.query.get(course_id).momo_ussd_code == "*182*1*123456#"


def test_s4_course_create_persists_difficulty_and_thumbnail(app, client, users):
    title = f"General Created {uuid.uuid4().hex[:8]}"
    resp = client.post(
        "/api/v1/courses",
        json={
            "title": title,
            "description": "created via general endpoint",
            "instructor_id": users["instructor"].id,
            "difficulty_level": "beginner",
            "thumbnail_url": "https://example.com/thumb.png",
            "enrollment_type": "free",
        },
        headers=_headers(app, users["admin"]),
    )
    assert resp.status_code == 201, resp.get_json()

    from src.models.course_models import Course

    created = Course.query.filter_by(title=title).first()
    assert created is not None
    assert created.difficulty_level == "beginner"
    assert created.thumbnail_url == "https://example.com/thumb.png"
