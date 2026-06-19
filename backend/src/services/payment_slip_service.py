"""
🧾 Payment Slip Service – Afritech Bridge LMS
Generates beautiful, printable HTML payment slips/receipts when payments are approved.

Can be rendered in browser or printed as PDF for student records.
"""

from datetime import datetime
from weasyprint import HTML
import base64
import hashlib
import io
import os
import qrcode


# ── Embedded logo (base64 + URL) ─────────────────────────────────────────────
_logo_path = os.path.join(os.path.dirname(__file__), "..", "..", "static", "images", "logo.jpg")
LOGO_BASE64 = ""
LOGO_URL = ""
try:
    with open(_logo_path, "rb") as f:
        LOGO_BASE64 = base64.b64encode(f.read()).decode("utf-8")
    # Try to get backend URL for the logo (preferred over base64 for reliability)
    _backend_url = os.environ.get('BACKEND_URL', '').rstrip('/')
    if _backend_url:
        LOGO_URL = f"{_backend_url}/api/v1/logo"
except FileNotFoundError:
    pass  # fall back to text-only header if logo file is missing


def _format_currency(amount, currency="USD"):
    """Format currency with symbol."""
    symbols = {
        "USD": "$", "EUR": "€", "GBP": "£", "RWF": "FRw",
        "XAF": "FCFA", "NGN": "₦", "GHS": "GH₵", "KES": "KES",
        "UGX": "UGX", "TZS": "TZS", "ZAR": "R", "INR": "₹",
    }
    sym = symbols.get(currency.upper(), currency + " ")
    return f"{sym} {int(amount):,}" if amount == int(amount) else f"{sym} {amount:,.2f}"


def _format_date(dt):
    """Format a datetime for display on the slip."""
    if dt is None:
        return "—"
    if isinstance(dt, str):
        return dt
    return dt.strftime("%B %d, %Y at %I:%M %p")


def generate_payment_slip_html(
    student_name,
    student_email,
    student_phone=None,
    course_title=None,
    cohort_label=None,
    cohort_start_date=None,
    cohort_end_date=None,
    amount_paid=None,
    currency="USD",
    payment_method=None,
    payment_reference=None,
    payment_date=None,
    payment_status="completed",
    enrollment_id=None,
    application_id=None,
    receipt_number=None,
    verification_hash=None,
    admin_name=None,
    institution_name="Afritech Bridge LMS",
    institution_address="Kigali, Rwanda",
    institution_email="afritech.bridge@yahoo.com",
    institution_phone="+250 780 784 924",
):
    """
    🧾 Generate a beautifully styled, print-ready payment slip as HTML.

    Args:
        student_name: str - Full name of the student
        student_email: str - Email of the student
        student_phone: str - Phone number (optional)
        course_title: str - Course name
        cohort_label: str - Cohort name/label
        cohort_start_date: datetime/str - Cohort start date
        cohort_end_date: datetime/str - Cohort end date
        amount_paid: float - Amount paid
        currency: str - Currency code
        payment_method: str - Payment method used
        payment_reference: str - Transaction/payment reference
        payment_date: datetime - When payment was processed
        payment_status: str - Status of payment
        enrollment_id: int - Enrollment ID
        application_id: int - Application ID
        receipt_number: str - Unique receipt number (auto-generated if omitted)
        admin_name: str - Name of admin who verified the payment
        institution_name: str - Institution name for the slip header

    Returns:
        str - Complete HTML document for the payment slip
    """
    # Auto-generate receipt number if not provided
    if not receipt_number:
        today = datetime.utcnow()
        receipt_number = f"RCP-{today.strftime('%Y%m%d')}-{enrollment_id or application_id or '0000'}"

    # Display labels for payment method
    method_labels = {
        "paypal": "PayPal",
        "mobile_money": "Mobile Money",
        "bank_transfer": "Bank Transfer",
        "stripe": "Stripe",
        "kpay": "K-Pay",
        "flutterwave": "Flutterwave",
        "momo_pay_code": "MoMo Pay Code (USSD)",
        "payment_screenshot": "Payment Screenshot",
        "Manual Payment": "Manual Payment",
    }
    method_label = method_labels.get(payment_method or "", payment_method or "—")

    # Status badge
    status_display = payment_status.replace("_", " ").title() if payment_status else "Completed"
    status_icon = "✅" if payment_status == "completed" else ("🔄" if payment_status == "pending" else "❌")
    status_color = "#059669" if payment_status == "completed" else ("#d97706" if payment_status == "pending" else "#dc2626")

    # Format values
    amount_formatted = _format_currency(amount_paid, currency) if amount_paid else "—"
    date_formatted = _format_date(payment_date)
    cohort_start_fmt = _format_date(cohort_start_date)
    cohort_end_fmt = _format_date(cohort_end_date)

    # Build the logo image tag (prefer URL over base64 for better cross-client compatibility)
    logo_img = ""
    if LOGO_URL:
        logo_img = f'<img src="{LOGO_URL}" alt="{institution_name}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.25);box-shadow:0 2px 12px rgba(0,0,0,0.15);" />'
    elif LOGO_BASE64:
        logo_img = f'<img src="data:image/jpeg;base64,{LOGO_BASE64}" alt="{institution_name}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.25);box-shadow:0 2px 12px rgba(0,0,0,0.15);" />'
    else:
        logo_img = '<span style="font-size:32px;line-height:52px;">✦</span>'

    # ── Generate QR Code for payment verification ──────────────────────────
    qr_code_html = ""
    qr_verification_url = ""
    try:
        # Use the stored verification hash if provided (from Enrollment.payment_verification_hash)
        # This ensures the QR code hash matches what's stored in the database.
        # Fall back to computing a deterministic hash if none is stored yet.
        verif_hash = verification_hash
        if not verif_hash:
            hash_raw = f"{enrollment_id}-{student_name}-{receipt_number}"
            verif_hash = hashlib.sha256(hash_raw.encode()).hexdigest()[:16]
        
        # Use FRONTEND_URL for the public verification page (the QR code links here)
        frontend_base = os.environ.get('FRONTEND_URL', 'https://study.afritechbridge.online').rstrip('/')
        if frontend_base and verif_hash:
            qr_verification_url = f"{frontend_base}/verify-payment/{verif_hash}"
        
        if qr_verification_url:
            # Generate QR code image
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_H,
                box_size=10,
                border=2,
            )
            qr.add_data(qr_verification_url)
            qr.make(fit=True)
            qr_img = qr.make_image(fill_color="#1e293b", back_color="white")
            
            # Convert to base64 PNG
            qr_buffer = io.BytesIO()
            qr_img.save(qr_buffer, format="PNG")
            qr_buffer.seek(0)
            qr_b64 = base64.b64encode(qr_buffer.read()).decode("utf-8")
            
            qr_code_html = f'''
            <div style="text-align: center; margin: 20px 0 10px 0;">
                <div style="display: inline-block; background: #ffffff; border: 2px solid #e2e8f0; border-radius: 16px; padding: 20px 24px; box-shadow: 0 4px 15px rgba(0,0,0,0.06);">
                    <div style="margin-bottom: 10px;">
                        <img src="data:image/png;base64,{qr_b64}" alt="Payment Verification QR Code" style="width:140px;height:140px;" />
                    </div>
                    <p style="margin: 6px 0 0 0; font-size: 12px; color: #64748b; font-weight: 600; letter-spacing: 0.3px;">📱 Scan to Verify Payment</p>
                    <p style="margin: 2px 0 0 0; font-size: 10px; color: #94a3b8;">or visit: <span style="color: #14b8a6; word-break: break-all; font-family: monospace; font-size: 9px;">{qr_verification_url[:60]}...</span></p>
                </div>
            </div>'''
    except Exception as qr_err:
        logger = __import__('logging').getLogger(__name__)
        logger.warning(f"Could not generate QR code for payment slip: {qr_err}")
        qr_code_html = ""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Slip - {receipt_number}</title>
    <style>
        @page {{
            size: A4;
            margin: 0;
        }}
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f0f2f5;
            padding: 24px;
            color: #1e293b;
        }}

        /* ── Main Container ── */
        .slip-container {{
            max-width: 820px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 25px 80px rgba(0,0,0,0.10);
        }}

        /* ── Top Accent Ribbon ── */
        .top-ribbon {{
            height: 8px;
            background: linear-gradient(90deg, #1e3a8a 0%, #0f766e 40%, #14b8a6 70%, #10b981 100%);
        }}

        /* ── Header ── */
        .slip-header {{
            background: linear-gradient(135deg, #1e3a8a 0%, #0f766e 50%, #14b8a6 100%);
            padding: 28px 40px;
            color: #ffffff;
            position: relative;
            overflow: hidden;
        }}
        /* Decorative circles */
        .slip-header::before {{
            content: '';
            position: absolute;
            top: -40%;
            right: -10%;
            width: 320px;
            height: 320px;
            background: radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%);
            border-radius: 50%;
        }}
        .slip-header::after {{
            content: '';
            position: absolute;
            bottom: -50%;
            left: -5%;
            width: 240px;
            height: 240px;
            background: radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%);
            border-radius: 50%;
        }}
        /* Angled decorative stripe */
        .header-stripe {{
            position: absolute;
            top: -30px;
            right: 120px;
            width: 80px;
            height: 200px;
            background: rgba(255,255,255,0.03);
            transform: rotate(-15deg);
            z-index: 0;
        }}
        .header-stripe-2 {{
            position: absolute;
            top: 20px;
            right: 180px;
            width: 50px;
            height: 160px;
            background: rgba(255,255,255,0.02);
            transform: rotate(-25deg);
            z-index: 0;
        }}
        .slip-header-content {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            position: relative;
            z-index: 1;
        }}
        .slip-brand {{
            display: flex;
            align-items: center;
            gap: 16px;
        }}
        .slip-brand-text h1 {{
            font-size: 22px;
            font-weight: 800;
            letter-spacing: -0.3px;
            margin-bottom: 2px;
        }}
        .slip-brand-text p {{
            color: rgba(255,255,255,0.80);
            font-size: 12px;
            font-weight: 500;
        }}
        .slip-badge {{
            text-align: right;
        }}
        .slip-badge .receipt-label {{
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 2.5px;
            color: rgba(255,255,255,0.65);
            margin-bottom: 6px;
        }}
        .slip-badge .receipt-number {{
            font-size: 17px;
            font-weight: 700;
            font-family: 'Courier New', monospace;
            background: rgba(255,255,255,0.12);
            padding: 6px 18px;
            border-radius: 10px;
            display: inline-block;
            letter-spacing: 0.5px;
        }}

        /* ── Body ── */
        .slip-body {{
            padding: 40px 44px;
        }}
        .slip-title {{
            text-align: center;
            margin-bottom: 30px;
        }}
        .slip-title h2 {{
            font-size: 24px;
            color: #0f172a;
            font-weight: 800;
            margin-bottom: 4px;
            letter-spacing: -0.3px;
        }}
        .slip-title p {{
            color: #64748b;
            font-size: 14px;
        }}
        .status-badge {{
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 22px;
            border-radius: 24px;
            font-size: 14px;
            font-weight: 600;
            background: {status_color}12;
            color: {status_color};
            border: 1.5px solid {status_color}30;
            margin-top: 14px;
        }}

        /* ── Payment Summary Hero ── */
        .payment-hero {{
            background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #d1fae5 100%);
            border: 2px solid #10b981;
            border-radius: 16px;
            padding: 28px 30px;
            margin-bottom: 32px;
            position: relative;
            overflow: hidden;
        }}
        .payment-hero::before {{
            content: '';
            position: absolute;
            top: -40px;
            right: -40px;
            width: 120px;
            height: 120px;
            background: rgba(16,185,129,0.06);
            border-radius: 50%;
        }}
        .payment-hero-header {{
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 18px;
        }}
        .payment-hero-header h3 {{
            font-size: 14px;
            color: #047857;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
        }}
        .payment-hero-total {{
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        .payment-hero-total .label {{
            font-size: 15px;
            color: #065f46;
            font-weight: 600;
        }}
        .payment-hero-total .amount {{
            font-size: 36px;
            font-weight: 800;
            color: #059669;
            letter-spacing: -1px;
        }}
        .payment-hero-meta {{
            display: flex;
            gap: 32px;
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1.5px dashed #a7f3d0;
        }}
        .payment-hero-meta .meta-item {{
            flex: 1;
        }}
        .payment-hero-meta .meta-item .meta-label {{
            font-size: 10px;
            color: #6ee7b7;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            font-weight: 600;
        }}
        .payment-hero-meta .meta-item .meta-value {{
            font-size: 13px;
            color: #065f46;
            font-weight: 600;
            margin-top: 2px;
        }}

        /* ── Grid Sections ── */
        .slip-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 28px;
        }}
        .slip-section {{
            background: #fafbfc;
            border: 1px solid #e8ecf1;
            border-radius: 14px;
            padding: 20px 22px;
        }}
        .slip-section.full-width {{
            grid-column: 1 / -1;
        }}
        .slip-section h3 {{
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #64748b;
            font-weight: 700;
            margin-bottom: 14px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e8ecf1;
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        .slip-section h3 .icon {{
            font-size: 15px;
        }}
        .info-row {{
            display: flex;
            justify-content: space-between;
            padding: 7px 0;
            font-size: 13.5px;
            border-bottom: 1px solid #f1f5f9;
        }}
        .info-row:last-child {{
            border-bottom: none;
        }}
        .info-row .label {{
            color: #64748b;
            font-weight: 500;
        }}
        .info-row .value {{
            color: #0f172a;
            font-weight: 600;
            text-align: right;
        }}

        /* ── Decorative divider ── */
        .section-divider {{
            text-align: center;
            margin: 6px 0 22px 0;
            color: #cbd5e1;
            font-size: 18px;
            letter-spacing: 6px;
        }}

        /* ── Terms ── */
        .terms-content {{
            font-size: 13px;
            color: #475569;
            line-height: 1.8;
        }}
        .terms-content p {{
            margin-bottom: 8px;
            padding-left: 16px;
            position: relative;
        }}
        .terms-content p::before {{
            content: '';
            position: absolute;
            left: 0;
            top: 8px;
            width: 6px;
            height: 6px;
            background: #14b8a6;
            border-radius: 50%;
        }}

        /* ── Footer ── */
        .slip-footer {{
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
            padding: 24px 44px;
            text-align: center;
        }}
        .slip-footer p {{
            color: #94a3b8;
            font-size: 12px;
            line-height: 1.8;
        }}
        .slip-footer .brand {{
            color: #14b8a6;
            font-weight: 700;
            font-size: 14px;
            margin-bottom: 6px;
            letter-spacing: 0.5px;
        }}
        .slip-footer .actions {{
            margin-top: 18px;
            display: flex;
            justify-content: center;
            gap: 12px;
        }}
        .btn-print {{
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 10px 26px;
            background: #1e293b;
            color: #ffffff;
            border: none;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            transition: background 0.2s;
        }}
        .btn-print:hover {{
            background: #334155;
        }}
        .btn-download {{
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 10px 26px;
            background: #0f766e;
            color: #ffffff;
            border: none;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            transition: background 0.2s;
        }}
        .btn-download:hover {{
            background: #0d9488;
        }}

        /* ── Watermark ── */
        .watermark {{
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-30deg);
            font-size: 120px;
            font-weight: 900;
            color: rgba(20,184,166,0.025);
            white-space: nowrap;
            pointer-events: none;
            z-index: 0;
            letter-spacing: 20px;
            text-transform: uppercase;
        }}

        /* ── Print Styles ── */
        @media print {{
            body {{
                background: #ffffff;
                padding: 0;
            }}
            .slip-container {{
                box-shadow: none;
                border-radius: 0;
            }}
            .btn-print, .btn-download {{
                display: none;
            }}
        }}

        /* ── Responsive ── */
        @media (max-width: 600px) {{
            body {{
                padding: 12px;
            }}
            .slip-header-content {{
                flex-direction: column;
                gap: 16px;
            }}
            .slip-badge {{
                text-align: left;
            }}
            .slip-grid {{
                grid-template-columns: 1fr;
            }}
            .slip-body {{
                padding: 24px 20px;
            }}
            .payment-hero-total {{
                flex-direction: column;
                align-items: flex-start;
                gap: 4px;
            }}
            .payment-hero-meta {{
                flex-direction: column;
                gap: 12px;
            }}
            .slip-footer {{
                padding: 20px;
            }}
            .slip-header {{
                padding: 20px 24px;
            }}
        }}
    </style>
</head>
<body>
    <div class="slip-container" id="payment-slip">
        <!-- TOP RIBBON -->
        <div class="top-ribbon"></div>

        <!-- HEADER -->
        <div class="slip-header">
            <div class="header-stripe"></div>
            <div class="header-stripe-2"></div>
            <div class="watermark">PAID</div>
            <div class="slip-header-content">
                <div class="slip-brand">
                    {logo_img}
                    <div class="slip-brand-text">
                        <h1>{institution_name}</h1>
                        <p>{institution_address} &nbsp;·&nbsp; {institution_phone}</p>
                        <p>{institution_email}</p>
                    </div>
                </div>
                <div class="slip-badge">
                    <div class="receipt-label">Receipt No.</div>
                    <div class="receipt-number">{receipt_number}</div>
                </div>
            </div>
        </div>

        <!-- BODY -->
        <div class="slip-body">
            <div class="slip-title">
                <h2>🎓 Payment Confirmation Slip</h2>
                <p>Official Receipt of Payment</p>
                <div class="status-badge">
                    {status_icon} {status_display}
                </div>
            </div>

            <!-- PAYMENT HERO -->
            <div class="payment-hero">
                <div class="payment-hero-header">
                    <span style="font-size:20px;">💰</span>
                    <h3>Payment Summary</h3>
                </div>
                <div class="payment-hero-total">
                    <span class="label">Total Amount Paid</span>
                    <span class="amount">{amount_formatted}</span>
                </div>
                <div class="payment-hero-meta">
                    <div class="meta-item">
                        <div class="meta-label">Payment Method</div>
                        <div class="meta-value">{method_label}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Transaction Ref</div>
                        <div class="meta-value" style="font-family:'Courier New',monospace;">{payment_reference or '—'}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Payment Date</div>
                        <div class="meta-value">{date_formatted}</div>
                    </div>
                </div>
            </div>

            <!-- DETAILS GRID -->
            <div class="slip-grid">
                <!-- Student Information -->
                <div class="slip-section">
                    <h3><span class="icon">👤</span> Student Information</h3>
                    <div class="info-row">
                        <span class="label">Full Name</span>
                        <span class="value">{student_name}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Email</span>
                        <span class="value">{student_email}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Phone</span>
                        <span class="value">{student_phone or '—'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Receipt No.</span>
                        <span class="value" style="font-family:'Courier New',monospace;">{receipt_number}</span>
                    </div>
                </div>

                <!-- Course & Cohort Information -->
                <div class="slip-section">
                    <h3><span class="icon">📚</span> Course &amp; Cohort</h3>
                    <div class="info-row">
                        <span class="label">Course</span>
                        <span class="value">{course_title or '—'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Cohort</span>
                        <span class="value">{cohort_label or '—'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Cohort Start</span>
                        <span class="value">{cohort_start_fmt}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Cohort End</span>
                        <span class="value">{cohort_end_fmt}</span>
                    </div>
                </div>

                <!-- Payment Details -->
                <div class="slip-section">
                    <h3><span class="icon">💳</span> Payment Details</h3>
                    <div class="info-row">
                        <span class="label">Method</span>
                        <span class="value">{method_label}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Reference</span>
                        <span class="value" style="font-family:'Courier New',monospace;">{payment_reference or '—'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Currency</span>
                        <span class="value">{currency.upper() if currency else 'USD'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Date</span>
                        <span class="value">{date_formatted}</span>
                    </div>
                </div>

                <!-- Administrative Info -->
                <div class="slip-section">
                    <h3><span class="icon">🏛️</span> Administrative</h3>
                    <div class="info-row">
                        <span class="label">Enrollment ID</span>
                        <span class="value" style="font-family:'Courier New',monospace;">#{enrollment_id or '—'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Application ID</span>
                        <span class="value" style="font-family:'Courier New',monospace;">#{application_id or '—'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Verified By</span>
                        <span class="value">{admin_name or 'Administrator'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Status</span>
                        <span class="value" style="color:{status_color};font-weight:700;">{status_display}</span>
                    </div>
                </div>
            </div>

            <div class="section-divider">• • • • • •</div>

            <!-- Terms & Notes -->
            <div class="slip-section full-width">
                <h3><span class="icon">📋</span> Terms &amp; Notes</h3>
                <div class="terms-content">
                    <p>This payment slip serves as an official receipt for the transaction described above.</p>
                    <p>The amount paid covers the course enrollment for the specified cohort period.</p>
                    <p>Your enrollment will be activated once the application period closes and before the cohort start date. You will receive separate login credentials via email.</p>
                    <p>For any inquiries regarding this payment, please contact <strong>{institution_email}</strong> or call <strong>{institution_phone}</strong>.</p>
                    <p>This is a computer-generated receipt and does not require a physical signature.</p>
                </div>
            </div>

            <!-- QR Code for Payment Verification -->
            {qr_code_html}
        </div>

        <!-- FOOTER -->
        <div class="slip-footer">
            <p class="brand">✦ {institution_name} ✦</p>
            <p>{institution_address} &nbsp;·&nbsp; {institution_email} &nbsp;·&nbsp; {institution_phone}</p>
            <p style="margin-top:4px;">© {datetime.utcnow().year} {institution_name}. All rights reserved.</p>
            <p style="margin-top:2px;font-size:11px;">Building Africa's Digital Future Through Education</p>
            <div class="actions">
                <button class="btn-print" onclick="window.print()">🖨️ Print</button>
                <button class="btn-download" onclick="downloadPDF()">📄 Download PDF</button>
            </div>
        </div>
    </div>

    <script>
        function downloadPDF() {{
            window.print();
        }}
    </script>
</body>
</html>"""


def generate_payment_slip_pdf(
    student_name,
    student_email,
    student_phone=None,
    course_title=None,
    cohort_label=None,
    cohort_start_date=None,
    cohort_end_date=None,
    amount_paid=None,
    currency="USD",
    payment_method=None,
    payment_reference=None,
    payment_date=None,
    payment_status="completed",
    enrollment_id=None,
    application_id=None,
    receipt_number=None,
    verification_hash=None,
    admin_name=None,
    institution_name="Afritech Bridge LMS",
    institution_address="Kigali, Rwanda",
    institution_email="afritech.bridge@yahoo.com",
    institution_phone="+250 780 784 924",
):
    """
    📄 Generate a payment slip as a PDF file (bytes) using WeasyPrint.
    Converts the HTML payment slip to a PDF suitable for email attachment.

    Returns:
        tuple: (pdf_bytes, filename) where pdf_bytes is the raw PDF data
               and filename is "Payment_Slip_XXXXX.pdf"
    """
    html_content = generate_payment_slip_html(
        student_name=student_name,
        student_email=student_email,
        student_phone=student_phone,
        course_title=course_title,
        cohort_label=cohort_label,
        cohort_start_date=cohort_start_date,
        cohort_end_date=cohort_end_date,
        amount_paid=amount_paid,
        currency=currency,
        payment_method=payment_method,
        payment_reference=payment_reference,
        payment_date=payment_date,
        payment_status=payment_status,
        enrollment_id=enrollment_id,
        application_id=application_id,
        receipt_number=receipt_number,
        verification_hash=verification_hash,
        admin_name=admin_name,
        institution_name=institution_name,
        institution_address=institution_address,
        institution_email=institution_email,
        institution_phone=institution_phone,
    )

    # Convert HTML to PDF
    pdf_bytes = HTML(string=html_content).write_pdf()

    # Generate filename
    if not receipt_number:
        today = datetime.utcnow()
        receipt_number = f"RCP-{today.strftime('%Y%m%d')}-{enrollment_id or application_id or '0000'}"
    filename = f"Payment_Slip_{receipt_number}.pdf"

    return pdf_bytes, filename
