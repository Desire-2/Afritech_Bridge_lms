"""
🧾 Payment Slip Service – Afritech Bridge LMS
Generates beautiful, printable HTML payment slips/receipts when payments are approved.

Can be rendered in browser or printed as PDF for student records.
"""

from datetime import datetime
from weasyprint import HTML


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
            background: #f1f5f9;
            padding: 20px;
            color: #1e293b;
        }}
        .slip-container {{
            max-width: 800px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.12);
        }}
        /* ── Header ── */
        .slip-header {{
            background: linear-gradient(135deg, #1e3a8a 0%, #0f766e 50%, #14b8a6 100%);
            padding: 30px 40px;
            color: #ffffff;
            position: relative;
            overflow: hidden;
        }}
        .slip-header::before {{
            content: '';
            position: absolute;
            top: -50%;
            right: -20%;
            width: 300px;
            height: 300px;
            background: rgba(255,255,255,0.05);
            border-radius: 50%;
        }}
        .slip-header::after {{
            content: '';
            position: absolute;
            bottom: -30%;
            left: -10%;
            width: 200px;
            height: 200px;
            background: rgba(255,255,255,0.03);
            border-radius: 50%;
        }}
        .slip-header-content {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            position: relative;
            z-index: 1;
        }}
        .slip-brand h1 {{
            font-size: 24px;
            font-weight: 800;
            letter-spacing: -0.5px;
            margin-bottom: 4px;
        }}
        .slip-brand p {{
            color: rgba(255,255,255,0.85);
            font-size: 13px;
            font-weight: 500;
        }}
        .slip-badge {{
            text-align: right;
        }}
        .slip-badge .receipt-label {{
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: rgba(255,255,255,0.7);
            margin-bottom: 4px;
        }}
        .slip-badge .receipt-number {{
            font-size: 18px;
            font-weight: 700;
            font-family: 'Courier New', monospace;
            background: rgba(255,255,255,0.15);
            padding: 6px 16px;
            border-radius: 8px;
            display: inline-block;
        }}
        /* ── Body ── */
        .slip-body {{
            padding: 40px;
        }}
        .slip-title {{
            text-align: center;
            margin-bottom: 32px;
        }}
        .slip-title h2 {{
            font-size: 22px;
            color: #0f172a;
            font-weight: 700;
            margin-bottom: 6px;
        }}
        .slip-title p {{
            color: #64748b;
            font-size: 14px;
        }}
        .status-badge {{
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 18px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            background: {status_color}15;
            color: {status_color};
            border: 1px solid {status_color}30;
        }}
        /* ── Grid Sections ── */
        .slip-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-bottom: 32px;
        }}
        .slip-section {{
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            transition: border-color 0.2s;
        }}
        .slip-section:hover {{
            border-color: #94a3b8;
        }}
        .slip-section.full-width {{
            grid-column: 1 / -1;
        }}
        .slip-section h3 {{
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #64748b;
            font-weight: 600;
            margin-bottom: 16px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e2e8f0;
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        .slip-section h3 .icon {{
            font-size: 16px;
        }}
        .info-row {{
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            font-size: 14px;
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
        .info-row .value.highlight {{
            color: #059669;
            font-size: 16px;
        }}
        /* ── Amount Summary ── */
        .payment-summary {{
            background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
            border: 2px solid #10b981;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 32px;
        }}
        .payment-summary h3 {{
            font-size: 14px;
            color: #047857;
            font-weight: 600;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        .payment-total {{
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        .payment-total .label {{
            font-size: 16px;
            color: #065f46;
            font-weight: 600;
        }}
        .payment-total .amount {{
            font-size: 32px;
            font-weight: 800;
            color: #059669;
        }}
        .payment-details {{
            display: flex;
            gap: 24px;
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px dashed #a7f3d0;
        }}
        .payment-details .detail {{
            flex: 1;
        }}
        .payment-details .detail .label {{
            font-size: 11px;
            color: #6ee7b7;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .payment-details .detail .value {{
            font-size: 13px;
            color: #065f46;
            font-weight: 600;
        }}
        /* ── Footer ── */
        .slip-footer {{
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
            padding: 24px 40px;
            text-align: center;
        }}
        .slip-footer p {{
            color: #94a3b8;
            font-size: 12px;
            line-height: 1.7;
        }}
        .slip-footer .brand {{
            color: #14b8a6;
            font-weight: 700;
            font-size: 14px;
            margin-bottom: 6px;
        }}
        .slip-footer .actions {{
            margin-top: 16px;
            display: flex;
            justify-content: center;
            gap: 12px;
        }}
        .btn-print {{
            display: inline-block;
            padding: 10px 24px;
            background: #1e293b;
            color: #ffffff;
            border: none;
            border-radius: 8px;
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
            display: inline-block;
            padding: 10px 24px;
            background: #0f766e;
            color: #ffffff;
            border: none;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            transition: background 0.2s;
        }}
        .btn-download:hover {{
            background: #0d9488;
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
            .slip-section:hover {{
                border-color: #e2e8f0;
            }}
        }}
        @media (max-width: 600px) {{
            .slip-header-content {{
                flex-direction: column;
                gap: 12px;
            }}
            .slip-badge {{
                text-align: left;
            }}
            .slip-grid {{
                grid-template-columns: 1fr;
            }}
            .payment-total {{
                flex-direction: column;
                align-items: flex-start;
                gap: 4px;
            }}
            .payment-details {{
                flex-direction: column;
                gap: 8px;
            }}
            .slip-body {{
                padding: 20px;
            }}
        }}
    </style>
</head>
<body>
    <div class="slip-container" id="payment-slip">
        <!-- HEADER -->
        <div class="slip-header">
            <div class="slip-header-content">
                <div class="slip-brand">
                    <h1>✦ {institution_name}</h1>
                    <p>{institution_address} · {institution_phone}</p>
                    <p>{institution_email}</p>
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
                <div class="status-badge" style="margin-top:12px;">
                    {status_icon} {status_display}
                </div>
            </div>

            <!-- PAYMENT SUMMARY -->
            <div class="payment-summary">
                <h3>💰 Payment Summary</h3>
                <div class="payment-total">
                    <span class="label">Total Amount Paid</span>
                    <span class="amount">{amount_formatted}</span>
                </div>
                <div class="payment-details">
                    <div class="detail">
                        <div class="label">Payment Method</div>
                        <div class="value">{method_label}</div>
                    </div>
                    <div class="detail">
                        <div class="label">Transaction Ref</div>
                        <div class="value" style="font-family:'Courier New',monospace;">{payment_reference or '—'}</div>
                    </div>
                    <div class="detail">
                        <div class="label">Payment Date</div>
                        <div class="value">{date_formatted}</div>
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

            <!-- Terms & Notes -->
            <div class="slip-section full-width">
                <h3><span class="icon">📋</span> Terms &amp; Notes</h3>
                <div style="font-size:13px;color:#475569;line-height:1.7;">
                    <p style="margin-bottom:8px;">
                        1. This payment slip serves as an official receipt for the transaction described above.
                    </p>
                    <p style="margin-bottom:8px;">
                        2. The amount paid covers the course enrollment for the specified cohort period.
                    </p>
                    <p style="margin-bottom:8px;">
                        3. Your enrollment will be activated once the application period closes and before the cohort start date.
                        You will receive separate login credentials via email.
                    </p>
                    <p style="margin-bottom:8px;">
                        4. For any inquiries regarding this payment, please contact <strong>{institution_email}</strong>
                        or call <strong>{institution_phone}</strong>.
                    </p>
                    <p>
                        5. This is a computer-generated receipt and does not require a physical signature.
                    </p>
                </div>
            </div>
        </div>

        <!-- FOOTER -->
        <div class="slip-footer">
            <p class="brand">✦ {institution_name} ✦</p>
            <p>{institution_address} · {institution_email} · {institution_phone}</p>
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