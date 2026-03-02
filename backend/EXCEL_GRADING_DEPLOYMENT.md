# Excel AI Grading Agent — Deployment & Usage Guide

## Overview

The **Excel AI Grading Agent** automatically analyzes and grades MS Excel assignment submissions in the Afritec Bridge LMS. It evaluates formulas, pivot tables, charts, VBA macros, Power Query, and formatting — producing a structured score with detailed feedback.

**Scope**: Only processes submissions for courses whose title or description contains "Excel" / "MS Excel" / "Microsoft Excel" / "Spreadsheet".

---

## Architecture

```
src/services/excel_grading/
├── __init__.py                 # Package entry — exports ExcelGradingService
├── excel_grading_service.py    # Main orchestrator (pipeline coordinator)
├── excel_analyzer.py           # Workbook structure analysis (openpyxl / pandas)
├── formula_analyzer.py         # Formula detection, categorization, complexity
├── chart_analyzer.py           # Chart type detection, diversity scoring
├── pivot_analyzer.py           # PivotTable XML parsing from OOXML
├── vba_analyzer.py             # VBA macro extraction, security analysis
├── power_query_analyzer.py     # Power Query M-code detection & analysis
├── formatting_analyzer.py      # Formatting, data validation, usability
├── grading_engine.py           # Score computation per 7-criteria rubric
└── feedback_generator.py       # Expert-style markdown feedback

src/models/
└── excel_grading_models.py     # ExcelGradingResult SQLAlchemy model

src/routes/
└── excel_grading_routes.py     # REST API blueprint (excel_grading_bp)
```

---

## Installation

### 1. Install new Python dependencies

```bash
cd backend
pip install openpyxl==3.1.5 oletools==0.60.2 xlrd==2.0.1
# or:
pip install -r requirements.txt
```

### 2. Database migration

The `ExcelGradingResult` model creates the `excel_grading_results` table automatically via `db.create_all()` on application startup (standard for this project). No manual migration needed.

If you're running in production on PostgreSQL, restart the app and confirm:

```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'excel_grading_results';
```

### 3. Verify blueprint registration

The `excel_grading_bp` blueprint is registered in `main.py`:

```python
from src.routes.excel_grading_routes import excel_grading_bp
# ...
app.register_blueprint(excel_grading_bp)  # Prefix: /api/v1/excel-grading
```

### 4. Restart the server

```bash
./run.sh   # development
# or
gunicorn --config gunicorn_config.py app:app   # production
```

---

## API Endpoints

All endpoints require **instructor** or **admin** JWT authentication.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/excel-grading/grade/<submission_id>` | Grade a single submission |
| `POST` | `/api/v1/excel-grading/grade-batch/<assignment_id>` | Batch-grade all submissions |
| `GET` | `/api/v1/excel-grading/results/<result_id>` | Get grading result by ID |
| `GET` | `/api/v1/excel-grading/results/submission/<id>` | Get result by submission ID |
| `POST` | `/api/v1/excel-grading/review/<result_id>` | Instructor review / override |
| `GET` | `/api/v1/excel-grading/submissions?course_id=X` | List gradeable submissions |
| `GET` | `/api/v1/excel-grading/history?course_id=X` | Grading history |

### Grade a submission

```bash
curl -X POST https://your-api.com/api/v1/excel-grading/grade/42 \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"submission_type": "assignment", "force": false}'
```

**Response** (200):

```json
{
  "status": "completed",
  "processing_time": 3.45,
  "result": {
    "id": 1,
    "total_score": 82.5,
    "max_score": 100,
    "grade_letter": "B",
    "confidence": "high",
    "rubric_breakdown": {
      "Formulas":     { "score": 22, "max": 25, "comment": "..." },
      "PivotTables":  { "score": 12, "max": 15, "comment": "..." },
      "Charts":       { "score": 9,  "max": 10, "comment": "..." },
      "PowerQuery_M": { "score": 15, "max": 15, "comment": "Not required — full marks" },
      "VBA":          { "score": 15, "max": 15, "comment": "Not required — full marks" },
      "Formatting":   { "score": 7,  "max": 10, "comment": "..." },
      "Completeness": { "score": 8,  "max": 10, "comment": "..." }
    },
    "overall_feedback": "## Grading Report\n...",
    "manual_review_required": false
  },
  "strict_json": { ... }
}
```

### Batch grade

```bash
curl -X POST https://your-api.com/api/v1/excel-grading/grade-batch/5 \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"submission_type": "assignment"}'
```

### Instructor review / override

```bash
curl -X POST https://your-api.com/api/v1/excel-grading/review/1 \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "override",
    "adjusted_score": 90,
    "adjusted_grade": "A",
    "instructor_notes": "Student demonstrated extra initiative.",
    "apply_to_submission": true
  }'
```

---

## Rubric Criteria (Default)

| Criterion | Max Points | What it evaluates |
|-----------|-----------|-------------------|
| **Formulas** | 25 | Function diversity, complexity, nesting, error handling |
| **PivotTables** | 15 | Pivot count, fields, slicers, calculated fields |
| **Charts** | 10 | Chart count, type diversity, titles |
| **PowerQuery_M** | 15 | Query count, transformations, data sources |
| **VBA** | 15 | Module count, procedures, practices, security |
| **Formatting** | 10 | Conditional formatting, validation, named ranges |
| **Completeness** | 10 | Sheet presence, data density, requirement compliance |

> If an instructor has created a **Rubric** in the grading system for the course, the engine maps criteria by keyword to the categories above. Unmatched criteria default to **Completeness**.

> Features not required by the assignment (e.g., VBA in a beginner assignment) automatically receive **full marks** so students are not penalized.

---

## Grading Pipeline Flow

```
1. Load submission → validate course is Excel
2. Extract file metadata from submission JSON
3. Filter to .xlsx / .xlsm / .xls / .csv only
4. Download file bytes from Google Drive
5. Parse assignment description → machine requirements
6. Load instructor rubric (if any)
7. Run analyzers:
     ExcelAnalyzer → FormulaAnalyzer → ChartAnalyzer
     PivotAnalyzer → VBAAnalyzer → PowerQueryAnalyzer
     FormattingAnalyzer
8. GradingEngine computes scores per rubric criterion
9. FeedbackGenerator produces markdown feedback
10. Save ExcelGradingResult to database
11. Return strict JSON response
```

---

## Running Tests

```bash
cd backend

# With pytest
python -m pytest test_excel_grading.py -v

# Standalone (no pytest required)
python test_excel_grading.py
```

Tests cover:
- Each analyzer independently (formula, chart, pivot, VBA, PQ, formatting)
- Grading engine score computation and letter grades
- Feedback generation
- Model `to_strict_json()` format
- Requirement parser
- Course type validation
- Google Drive file ID extraction

---

## Supported File Types

| Extension | Engine | Formulas | Charts | Pivots | VBA | Power Query |
|-----------|--------|----------|--------|--------|-----|-------------|
| `.xlsx` | openpyxl | ✅ | ✅ | ✅ | ❌ | ✅ |
| `.xlsm` | openpyxl | ✅ | ✅ | ✅ | ✅ | ✅ |
| `.xls` | pandas/xlrd | ❌ limited | ❌ | ❌ | ❌ | ❌ |
| `.csv` | pandas | N/A | N/A | N/A | N/A | N/A |

---

## Security

- **VBA analysis** scans for 15+ suspicious patterns (Shell, Kill, SendKeys, PowerShell, etc.)
- High-risk VBA submissions receive a **0 score** for VBA and are **flagged for manual review**
- All grading results are stored with an **audit trail** (instructor_reviewed, reviewed_at, instructor_notes)
- The `apply_to_submission` flag controls whether the AI grade propagates to the real submission record

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `openpyxl not installed` | `pip install openpyxl==3.1.5` |
| `oletools not installed` | `pip install oletools==0.60.2` (VBA falls back to ZIP method) |
| Course not detected as Excel | Ensure course title/description contains "Excel" or "Spreadsheet" |
| File download fails | Verify Google Drive service account has access to the file |
| Score seems low/high | Check the assignment description — requirements are parsed from it |
| Grade not applied to submission | Ensure `apply_to_submission: true` in the review request |

---

## Environment Variables

No new environment variables required. The system uses the existing:

- `GOOGLE_SERVICE_ACCOUNT_JSON` — Google Drive access (for file download)
- `DATABASE_URL` — Database connection
- `JWT_SECRET_KEY` — Authentication

---

## Files Created / Modified

### New Files
| File | Purpose |
|------|---------|
| `src/models/excel_grading_models.py` | `ExcelGradingResult` model |
| `src/services/excel_grading/__init__.py` | Package entry |
| `src/services/excel_grading/excel_grading_service.py` | Main orchestrator |
| `src/services/excel_grading/excel_analyzer.py` | Workbook analysis |
| `src/services/excel_grading/formula_analyzer.py` | Formula analysis |
| `src/services/excel_grading/chart_analyzer.py` | Chart analysis |
| `src/services/excel_grading/pivot_analyzer.py` | Pivot Table analysis |
| `src/services/excel_grading/vba_analyzer.py` | VBA analysis |
| `src/services/excel_grading/power_query_analyzer.py` | Power Query analysis |
| `src/services/excel_grading/formatting_analyzer.py` | Formatting analysis |
| `src/services/excel_grading/grading_engine.py` | Score computation |
| `src/services/excel_grading/feedback_generator.py` | Feedback generation |
| `src/routes/excel_grading_routes.py` | API routes |
| `test_excel_grading.py` | Test suite |
| `EXCEL_GRADING_DEPLOYMENT.md` | This guide |

### Modified Files
| File | Change |
|------|--------|
| `main.py` | Added import + blueprint registration for `excel_grading_bp` and `ExcelGradingResult` |
| `src/models/__init__.py` | Added `ExcelGradingResult` import and export |
| `src/utils/google_drive_service.py` | Added `download_file_content()` method |
| `requirements.txt` | Added `openpyxl`, `oletools`, `xlrd` |
