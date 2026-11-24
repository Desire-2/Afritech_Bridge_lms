"""PDF/XLSX exports generated from the locked verified weekly calculation."""
import io
from datetime import datetime, timezone
from xml.sax.saxutils import escape

from .weekly_i18n import t
from ..services.weekly_report_service import WeeklyReportError


def _p(value):
    """Escape user-authored text before ReportLab parses it as markup."""
    return escape(str(value if value is not None else ''))


def _header(report, lang):
    return [
        (t('export.title', lang), report.report_number),
        (t('field.agent', lang), report.employee.full_name if report.employee else ''),
        (t('field.week', lang), report.period_label or ''),
        (t('field.due', lang), report.due_at.isoformat() if report.due_at else ''),
        (t('field.status', lang), t(f'status.{report.status}', lang)),
        (t('export.generatedAt', lang), datetime.now(timezone.utc).isoformat()),
    ]


def export_pdf(report, rows, calc, lang='en'):
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    except ImportError as exc:  # pragma: no cover - dependency declared in requirements
        raise WeeklyReportError('PDF export is unavailable', 'weekly_report.export_unavailable', 503) from exc

    output = io.BytesIO()
    doc = SimpleDocTemplate(output, pagesize=A4, title=report.report_number,
                            leftMargin=14 * mm, rightMargin=14 * mm,
                            topMargin=14 * mm, bottomMargin=14 * mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('WeeklyTitle', parent=styles['Title'], fontSize=16, spaceAfter=10)
    small = ParagraphStyle('WeeklyCell', parent=styles['BodyText'], fontSize=8, leading=10)
    story = [Paragraph(_p(t('export.title', lang)), title_style)]

    header_data = [[Paragraph(f'<b>{_p(label)}</b>', small), Paragraph(_p(value), small)]
                   for label, value in _header(report, lang)]
    header = Table(header_data, colWidths=[55 * mm, 115 * mm])
    header.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#CBD5E1')),
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#EFF6FF')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.extend([header, Spacer(1, 8 * mm)])

    table_data = [[Paragraph('<b>#</b>', small),
                   Paragraph(f'<b>{_p(t("export.statementItem", lang))}</b>', small),
                   Paragraph(f'<b>{_p(t("export.value", lang))}</b>', small)]]
    for row in rows:
        table_data.append([
            Paragraph(_p(row['item']), small),
            Paragraph(_p(row['label']), small),
            Paragraph(_p(row['value'] if row['value'] is not None else '—'), small),
        ])
    table = Table(table_data, colWidths=[10 * mm, 115 * mm, 45 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#CBD5E1')),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E3A5F')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(table)
    doc.build(story)
    output.seek(0)
    return output, 'application/pdf'


def export_xlsx(report, rows, calc, lang='en'):
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Alignment, Font, PatternFill
    except ImportError as exc:  # pragma: no cover - dependency declared in requirements
        raise WeeklyReportError('Excel export is unavailable', 'weekly_report.export_unavailable', 503) from exc

    wb = Workbook()
    ws = wb.active
    ws.title = 'Weekly Report'
    ws.append([t('export.title', lang)])
    ws['A1'].font = Font(bold=True, size=14)
    ws.append([])
    for label, value in _header(report, lang):
        ws.append([label, value or ''])
        ws.cell(ws.max_row, 1).font = Font(bold=True)
    ws.append([])
    header_row = ws.max_row + 1
    ws.append(['#', t('export.statementItem', lang), t('export.value', lang)])
    for cell in ws[header_row]:
        cell.font = Font(bold=True, color='FFFFFF')
        cell.fill = PatternFill('solid', fgColor='1E3A5F')
    for row in rows:
        ws.append([row['item'], row['label'], row['value']])
    ws.column_dimensions['A'].width = 8
    ws.column_dimensions['B'].width = 70
    ws.column_dimensions['C'].width = 26
    for row in ws.iter_rows():
        for cell in row:
            cell.alignment = Alignment(vertical='top', wrap_text=True)

    details = wb.create_sheet(t('export.verifiedCalculation', lang))
    details.append([t('export.component', lang), t('export.value', lang)])
    for cell in details[1]:
        cell.font = Font(bold=True, color='FFFFFF')
        cell.fill = PatternFill('solid', fgColor='1E3A5F')
    for key, value in (calc.get('components') or {}).items():
        details.append([key, value])
    details.append([])
    details.append(['MoMo reference', 'Provider', 'Amount', 'Verification'])
    for cell in details[details.max_row]:
        cell.font = Font(bold=True)
    for row in calc.get('momo_submissions', []):
        details.append([row.get('reference'), row.get('provider'), row.get('amount'),
                        row.get('verification_status')])
    details.column_dimensions['A'].width = 40
    details.column_dimensions['B'].width = 24
    details.column_dimensions['C'].width = 20
    details.column_dimensions['D'].width = 20

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
