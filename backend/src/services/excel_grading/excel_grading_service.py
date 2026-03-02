"""
Excel Grading Service — Main Orchestrator

Coordinates:
  1. File retrieval from Google Drive
  2. File type / course validation
  3. All analyzers (workbook, formulas, charts, pivots, VBA, Power Query, formatting)
  4. Grading engine
  5. Feedback generation
  6. Database persistence
  
Only processes MS Excel course submissions with allowed extensions.
"""

import json
import time
import logging
import re
from typing import Dict, Any, Optional, Tuple, List
from datetime import datetime

logger = logging.getLogger(__name__)

# Allowed Excel file extensions
ALLOWED_EXTENSIONS = {'.xlsx', '.xlsm', '.xls', '.csv'}

# Keywords to identify MS Excel courses
EXCEL_COURSE_KEYWORDS = [
    'ms excel', 'microsoft excel', 'excel', 'spreadsheet',
]


class ExcelGradingService:
    """
    Main service that orchestrates the AI grading pipeline for Excel submissions.
    
    Usage:
        from src.services.excel_grading import ExcelGradingService
        service = ExcelGradingService()
        result = service.grade_submission(submission_id, 'assignment')
    """

    def __init__(self):
        self._initialized = False

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def grade_submission(
        self,
        submission_id: int,
        submission_type: str = 'assignment',
        force: bool = False,
    ) -> Dict[str, Any]:
        """
        Grade a single submission.

        Args:
            submission_id: ID of AssignmentSubmission or ProjectSubmission
            submission_type: 'assignment' or 'project'
            force: Re-grade even if already graded

        Returns:
            Dict with full grading result or error.
        """
        start_time = time.time()

        try:
            # Step 1: Load submission and validate
            submission, assignment_or_project, course = self._load_submission(
                submission_id, submission_type
            )
            if not submission:
                return {
                    'message': 'Submission not found',
                    'reason': 'submission_not_found',
                    'status': 'failed',
                }

            # Step 2: Validate course is MS Excel
            if not self._is_excel_course(course):
                return {
                    'message': f'Course "{course.title}" is not an MS Excel course. AI grading only supports MS Excel courses.',
                    'reason': 'not_excel_course',
                    'status': 'skipped',
                }

            # Step 3: Check if already graded (unless force)
            if not force:
                existing = self._get_existing_result(submission_id, submission_type)
                if existing and existing.status == 'completed':
                    return {
                        'status': 'already_graded',
                        'result': existing.to_dict(),
                    }

            # Step 4: Get file(s) from submission
            files = self._extract_files(submission, submission_type)
            if not files:
                return {
                    'message': 'This submission does not contain any files. AI grading requires an uploaded Excel file to analyze.',
                    'reason': 'no_files',
                    'status': 'failed',
                }

            # Step 5: Filter to Excel files only
            excel_files = self._filter_excel_files(files)
            if not excel_files:
                file_names = [f.get('filename', '?') for f in files]
                return {
                    'message': f'No Excel files found in submission (found: {" ,".join(file_names)}). Supported types: {" ,".join(ALLOWED_EXTENSIONS)}',
                    'reason': 'no_excel_files',
                    'status': 'failed',
                }

            # Step 6: Download file content
            file_info = excel_files[0]  # Grade the first Excel file
            file_bytes = self._download_file(file_info)
            if not file_bytes:
                return {
                    'message': f'Could not download file "{file_info.get("filename", "unknown")}". The file may have been deleted or is inaccessible.',
                    'reason': 'download_failed',
                    'status': 'failed',
                }

            # Step 7: Parse assignment requirements
            requirements = self._parse_requirements(assignment_or_project)

            # Step 8: Get instructor rubric (if exists)
            instructor_rubric = self._get_instructor_rubric(assignment_or_project, course)

            # Step 9: Run the analysis pipeline
            grading_result = self._run_pipeline(
                file_bytes=file_bytes,
                file_name=file_info.get('original_filename') or file_info.get('filename', 'file.xlsx'),
                requirements=requirements,
                instructor_rubric=instructor_rubric,
            )

            # Step 10: Generate feedback
            feedback = grading_result.pop('feedback', '')

            # Step 11: Save to database
            processing_time = time.time() - start_time
            db_result = self._save_result(
                submission_id=submission_id,
                submission_type=submission_type,
                student_id=submission.student_id,
                course_id=course.id,
                file_info=file_info,
                grading_result=grading_result,
                feedback=feedback,
                processing_time=processing_time,
            )

            return {
                'status': 'completed',
                'result': db_result.to_dict() if db_result else grading_result,
                'strict_json': db_result.to_strict_json() if db_result else None,
                'processing_time': round(processing_time, 2),
            }

        except Exception as e:
            logger.error(f"Excel grading failed for {submission_type} {submission_id}: {e}")
            logger.exception(e)
            return {
                'message': f'An unexpected error occurred during AI grading: {str(e)}',
                'reason': 'internal_error',
                'status': 'failed',
                'processing_time': round(time.time() - start_time, 2),
            }

    def grade_batch(
        self,
        assignment_id: int,
        submission_type: str = 'assignment',
        force: bool = False,
    ) -> Dict[str, Any]:
        """
        Grade all ungraded submissions for an assignment/project.

        Returns:
            Summary with per-submission results.
        """
        from src.models.course_models import (
            Assignment, AssignmentSubmission, Project, ProjectSubmission
        )

        if submission_type == 'assignment':
            submissions = AssignmentSubmission.query.filter_by(
                assignment_id=assignment_id
            ).all()
        else:
            submissions = ProjectSubmission.query.filter_by(
                project_id=assignment_id
            ).all()

        results = []
        for sub in submissions:
            result = self.grade_submission(sub.id, submission_type, force=force)
            results.append({
                'submission_id': sub.id,
                'student_id': sub.student_id,
                'status': result.get('status'),
                'score': result.get('result', {}).get('total_score') if result.get('result') else None,
                'error': result.get('error'),
            })

        succeeded = sum(1 for r in results if r['status'] == 'completed')
        failed = sum(1 for r in results if r['status'] == 'failed')
        skipped = sum(1 for r in results if r['status'] in ('skipped', 'already_graded'))

        return {
            'total': len(results),
            'succeeded': succeeded,
            'failed': failed,
            'skipped': skipped,
            'results': results,
        }

    def preview_analysis(
        self,
        file_bytes: bytes,
        file_name: str,
    ) -> Dict[str, Any]:
        """
        Run analysis only (no grading/saving) for preview purposes.
        Useful for instructors to see what the AI will detect.
        """
        return self._run_pipeline(
            file_bytes=file_bytes,
            file_name=file_name,
            requirements={},
            instructor_rubric=None,
            grading_only=False,
        )

    # ------------------------------------------------------------------
    # Internal: Submission loading
    # ------------------------------------------------------------------

    def _load_submission(
        self, submission_id: int, submission_type: str
    ) -> Tuple[Any, Any, Any]:
        """Load submission, parent (assignment/project), and course."""
        from src.models.course_models import (
            Assignment, AssignmentSubmission, Project, ProjectSubmission, Course
        )

        if submission_type == 'assignment':
            submission = AssignmentSubmission.query.get(submission_id)
            if not submission:
                return None, None, None
            parent = Assignment.query.get(submission.assignment_id)
            if not parent:
                return None, None, None
            course = Course.query.get(parent.course_id)
        elif submission_type == 'project':
            submission = ProjectSubmission.query.get(submission_id)
            if not submission:
                return None, None, None
            parent = Project.query.get(submission.project_id)
            if not parent:
                return None, None, None
            course = Course.query.get(parent.course_id)
        else:
            return None, None, None

        return submission, parent, course

    def _is_excel_course(self, course) -> bool:
        """Check if the course is an MS Excel course."""
        title = (course.title or '').lower()
        description = (course.description or '').lower()
        combined = f"{title} {description}"

        return any(kw in combined for kw in EXCEL_COURSE_KEYWORDS)

    # ------------------------------------------------------------------
    # Internal: File handling
    # ------------------------------------------------------------------

    def _extract_files(self, submission, submission_type: str) -> List[Dict[str, Any]]:
        """Extract file metadata from submission."""
        files = []

        if submission_type == 'assignment':
            # AssignmentSubmission stores files as JSON in file_url
            raw = getattr(submission, 'file_url', None)
            if raw:
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, list):
                        files.extend(parsed)
                    elif isinstance(parsed, dict):
                        files.append(parsed)
                except (json.JSONDecodeError, TypeError):
                    # Might be a plain URL
                    files.append({'url': raw, 'filename': 'submission_file'})
        else:
            # ProjectSubmission has file_path and file_name
            fp = getattr(submission, 'file_path', None)
            fn = getattr(submission, 'file_name', None)
            if fp:
                files.append({
                    'url': fp,
                    'filename': fn or 'project_file',
                    'original_filename': fn,
                })

        return files

    def _filter_excel_files(self, files: List[Dict]) -> List[Dict]:
        """Filter to only Excel file types."""
        result = []
        for f in files:
            name = (f.get('original_filename') or f.get('filename') or '').lower()
            ext = '.' + name.rsplit('.', 1)[-1] if '.' in name else ''
            if ext in ALLOWED_EXTENSIONS:
                result.append(f)
        return result

    def _download_file(self, file_info: Dict) -> Optional[bytes]:
        """
        Download file content from any supported storage backend.

        Supports:
          - Google Drive (file_id or drive.google.com URL)
          - Vercel Blob (public HTTPS blob URL)
          - Any public HTTP/HTTPS URL
          - Relative/local paths (attempted via HTTP from frontend)
        """
        url = (
            file_info.get('url')
            or file_info.get('view_link')
            or file_info.get('download_link')
            or ''
        )
        storage = (file_info.get('storage') or '').lower()

        # ----------------------------------------------------------
        # 1. Explicit Google Drive file_id
        # ----------------------------------------------------------
        file_id = file_info.get('file_id') or file_info.get('fileId')
        if file_id:
            content = self._download_from_google_drive(file_id)
            if content:
                return content

        # ----------------------------------------------------------
        # 2. Google Drive URL → extract file_id
        # ----------------------------------------------------------
        if storage == 'google_drive' or self._is_google_drive_url(url):
            gd_file_id = self._extract_file_id_from_url(url)
            if gd_file_id:
                content = self._download_from_google_drive(gd_file_id)
                if content:
                    return content

        # ----------------------------------------------------------
        # 3. Vercel Blob or any absolute HTTP(S) URL → HTTP GET
        # ----------------------------------------------------------
        if url.startswith('http://') or url.startswith('https://'):
            content = self._download_from_url(url)
            if content:
                return content

        # ----------------------------------------------------------
        # 4. Relative path (e.g. /uploads/...) — resolve against
        #    the frontend origin or known deployment URLs
        # ----------------------------------------------------------
        if url and url.startswith('/'):
            frontend_origins = self._get_frontend_origins()
            for origin in frontend_origins:
                full_url = origin.rstrip('/') + url
                logger.info(f"Trying relative path via frontend: {full_url[:120]}")
                content = self._download_from_url(full_url)
                if content:
                    return content

        # ----------------------------------------------------------
        # 5. Explicit download_url / downloadUrl field
        # ----------------------------------------------------------
        download_url = file_info.get('download_url') or file_info.get('downloadUrl')
        if download_url and (download_url.startswith('http://') or download_url.startswith('https://')):
            content = self._download_from_url(download_url)
            if content:
                return content

        logger.warning(f"Could not download file from any provider: {file_info}")
        return None

    @staticmethod
    def _get_frontend_origins() -> List[str]:
        """
        Return a list of frontend origins to try when resolving relative URLs.
        Reads ALLOWED_ORIGINS, FRONTEND_URL env vars, plus common defaults.
        """
        import os
        origins: List[str] = []

        # Explicit frontend URL (highest priority)
        frontend_url = os.environ.get('FRONTEND_URL', '').strip()
        if frontend_url:
            origins.append(frontend_url)

        # ALLOWED_ORIGINS (comma-separated, used for CORS)
        allowed = os.environ.get('ALLOWED_ORIGINS', '').strip()
        if allowed:
            for o in allowed.split(','):
                o = o.strip()
                if o and o not in origins:
                    origins.append(o)

        # Common development defaults
        for default in ['http://localhost:3000', 'http://localhost:3001']:
            if default not in origins:
                origins.append(default)

        return origins

    # ---- download helpers ----

    @staticmethod
    def _is_google_drive_url(url: str) -> bool:
        """Check if URL points to Google Drive."""
        if not url:
            return False
        return any(domain in url for domain in (
            'drive.google.com',
            'docs.google.com',
            'googleusercontent.com',
        ))

    @staticmethod
    def _download_from_google_drive(file_id: str) -> Optional[bytes]:
        """Download file bytes via Google Drive service."""
        try:
            from src.utils.google_drive_service import google_drive_service
            return google_drive_service.download_file_content(file_id)
        except Exception as e:
            logger.error(f"Google Drive download failed for {file_id}: {e}")
            return None

    @staticmethod
    def _download_from_url(url: str) -> Optional[bytes]:
        """
        Download file bytes from any public HTTP/HTTPS URL.
        Handles Vercel Blob, S3, and any publicly accessible file.
        """
        import requests as http_requests

        try:
            logger.info(f"Downloading file from URL: {url[:120]}...")
            resp = http_requests.get(url, timeout=60, stream=True)
            resp.raise_for_status()

            # Sanity-check: reject HTML error pages
            content_type = resp.headers.get('Content-Type', '')
            if 'text/html' in content_type and resp.status_code == 200:
                # Might be a redirect/login page rather than the actual file
                first_bytes = resp.content[:50]
                if b'<!DOCTYPE' in first_bytes or b'<html' in first_bytes:
                    logger.warning(
                        f"URL returned HTML instead of a file — possible auth wall: {url[:80]}"
                    )
                    return None

            content = resp.content
            if not content:
                logger.warning(f"Empty response from URL: {url[:80]}")
                return None

            logger.info(
                f"Downloaded {len(content)} bytes from URL "
                f"(content-type: {content_type})"
            )
            return content

        except Exception as e:
            logger.error(f"HTTP download failed for {url[:80]}: {e}")
            return None

    def _extract_file_id_from_url(self, url: str) -> Optional[str]:
        """Extract Google Drive file ID from URL."""
        if not url:
            return None
        # Pattern: /d/{file_id}/ or ?id={file_id}
        patterns = [
            r'/d/([a-zA-Z0-9_-]+)',
            r'[?&]id=([a-zA-Z0-9_-]+)',
            r'/file/d/([a-zA-Z0-9_-]+)',
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None

    # ------------------------------------------------------------------
    # Internal: Requirement parsing
    # ------------------------------------------------------------------

    def _parse_requirements(self, assignment_or_project) -> Dict[str, Any]:
        """Parse assignment description/instructions into machine-checkable requirements."""
        desc = (getattr(assignment_or_project, 'description', '') or '').lower()
        instructions = (getattr(assignment_or_project, 'instructions', '') or '').lower()
        combined = f"{desc} {instructions}"

        requirements: Dict[str, Any] = {}

        # Required functions detection
        function_keywords = {
            'vlookup': 'VLOOKUP',
            'xlookup': 'XLOOKUP',
            'hlookup': 'HLOOKUP',
            'index': 'INDEX',
            'match': 'MATCH',
            'index/match': 'INDEX',
            'sumif': 'SUMIF',
            'sumifs': 'SUMIFS',
            'countif': 'COUNTIF',
            'countifs': 'COUNTIFS',
            'averageif': 'AVERAGEIF',
            'averageifs': 'AVERAGEIFS',
            'if function': 'IF',
            'ifs function': 'IFS',
            'iferror': 'IFERROR',
            'text function': 'TEXT',
            'date function': 'DATE',
            'filter function': 'FILTER',
            'sort function': 'SORT',
            'unique function': 'UNIQUE',
            'let function': 'LET',
            'lambda': 'LAMBDA',
        }

        required_functions = []
        for keyword, func in function_keywords.items():
            if keyword in combined:
                if func not in required_functions:
                    required_functions.append(func)

        if required_functions:
            requirements['required_functions'] = required_functions

        # Feature requirements
        requirements['require_pivots'] = any(
            kw in combined for kw in ['pivot table', 'pivottable', 'pivot']
        )
        requirements['require_charts'] = any(
            kw in combined for kw in ['chart', 'graph', 'visualization']
        )
        requirements['require_vba'] = any(
            kw in combined for kw in ['vba', 'macro', 'automate', 'automation']
        )
        requirements['require_power_query'] = any(
            kw in combined for kw in ['power query', 'get & transform', 'm language', 'query editor']
        )
        requirements['require_conditional_formatting'] = any(
            kw in combined for kw in ['conditional format', 'highlight cells', 'data bars']
        )

        # Required sheets
        sheet_pattern = re.compile(
            r'(?:sheet|worksheet|tab)\s+(?:named?|called?|titled?)?\s*["\']?(\w[\w\s]*\w)["\']?',
            re.IGNORECASE
        )
        sheets = sheet_pattern.findall(combined)
        if sheets:
            requirements['required_sheets'] = [s.strip() for s in sheets]

        return requirements

    def _get_instructor_rubric(self, assignment_or_project, course) -> Optional[Dict[str, Any]]:
        """Get instructor rubric if available."""
        try:
            from src.models.grading_models import Rubric

            # Try course-specific rubric first
            rubric = Rubric.query.filter_by(course_id=course.id).first()
            if not rubric:
                # Try instructor's template rubric
                instructor_id = getattr(assignment_or_project, 'instructor_id', None)
                if not instructor_id:
                    instructor_id = course.instructor_id
                rubric = Rubric.query.filter_by(
                    instructor_id=instructor_id, is_template=True
                ).first()

            if rubric:
                return rubric.to_dict()
        except Exception as e:
            logger.debug(f"Could not load instructor rubric: {e}")

        return None

    # ------------------------------------------------------------------
    # Internal: Analysis pipeline
    # ------------------------------------------------------------------

    def _run_pipeline(
        self,
        file_bytes: bytes,
        file_name: str,
        requirements: Dict[str, Any],
        instructor_rubric: Optional[Dict[str, Any]],
        grading_only: bool = True,
    ) -> Dict[str, Any]:
        """Run the full analysis and grading pipeline."""
        from .excel_analyzer import ExcelAnalyzer
        from .formula_analyzer import FormulaAnalyzer
        from .chart_analyzer import ChartAnalyzer
        from .pivot_analyzer import PivotAnalyzer
        from .vba_analyzer import VBAAnalyzer
        from .power_query_analyzer import PowerQueryAnalyzer
        from .formatting_analyzer import FormattingAnalyzer
        from .grading_engine import GradingEngine
        from .feedback_generator import FeedbackGenerator

        # 1. Workbook structure analysis
        wb_analyzer = ExcelAnalyzer(file_bytes, file_name)
        wb_analysis = wb_analyzer.analyze()

        # 2. Formula analysis
        formula_analyzer = FormulaAnalyzer(wb_analysis)
        formula_analysis = formula_analyzer.analyze()

        # 3. Chart analysis
        chart_analyzer = ChartAnalyzer(wb_analysis)
        chart_analysis = chart_analyzer.analyze()

        # 4. Pivot Table analysis
        pivot_analyzer = PivotAnalyzer(file_bytes, wb_analysis)
        pivot_analysis = pivot_analyzer.analyze()

        # 5. VBA analysis
        vba_analyzer = VBAAnalyzer(file_bytes, wb_analysis)
        vba_analysis = vba_analyzer.analyze()

        # 6. Power Query analysis
        pq_analyzer = PowerQueryAnalyzer(file_bytes, wb_analysis)
        pq_analysis = pq_analyzer.analyze()

        # 7. Formatting analysis
        fmt_analyzer = FormattingAnalyzer(wb_analysis)
        fmt_analysis = fmt_analyzer.analyze()

        # 8. Grading
        engine = GradingEngine(
            workbook_analysis=wb_analysis,
            formula_analysis=formula_analysis,
            chart_analysis=chart_analysis,
            pivot_analysis=pivot_analysis,
            vba_analysis=vba_analysis,
            pq_analysis=pq_analysis,
            formatting_analysis=fmt_analysis,
            requirements=requirements,
            instructor_rubric=instructor_rubric,
        )
        grading_result = engine.grade()

        # 9. Feedback generation
        fb_gen = FeedbackGenerator(
            grading_result=grading_result,
            workbook_analysis=wb_analysis,
            formula_analysis=formula_analysis,
            chart_analysis=chart_analysis,
            pivot_analysis=pivot_analysis,
            vba_analysis=vba_analysis,
            pq_analysis=pq_analysis,
            formatting_analysis=fmt_analysis,
            assignment_title=file_name,
        )
        feedback = fb_gen.generate()
        grading_result['feedback'] = feedback

        # Include raw analysis data for debugging / detailed view
        grading_result['analysis_data'] = {
            'workbook': {k: v for k, v in wb_analysis.items() if k != 'sheets'},
            'workbook_sheets_summary': [
                {
                    'name': s['name'],
                    'rows': s['row_count'],
                    'cols': s['column_count'],
                    'formulas': s['formula_count'],
                    'charts': s['chart_count'],
                    'pivots': s['pivot_count'],
                }
                for s in wb_analysis.get('sheets', [])
            ],
            'formula_summary': {
                'count': formula_analysis.get('formula_count', 0),
                'categories': list(formula_analysis.get('function_categories', {}).keys()),
                'advanced': formula_analysis.get('advanced_functions_used', []),
                'complexity': formula_analysis.get('complexity_score', 0),
            },
            'charts': {
                'count': chart_analysis.get('chart_count', 0),
                'types': chart_analysis.get('chart_types', []),
            },
            'pivots': {
                'count': pivot_analysis.get('pivot_count', 0),
                'has_slicers': pivot_analysis.get('has_slicers', False),
                'has_calculated_fields': pivot_analysis.get('has_calculated_fields', False),
            },
            'vba': {
                'has_vba': vba_analysis.get('has_vba', False),
                'modules': vba_analysis.get('module_count', 0),
                'procedures': vba_analysis.get('total_procedures', 0),
                'security_risk': vba_analysis.get('security', {}).get('risk_level', 'none'),
            },
            'power_query': {
                'has_pq': pq_analysis.get('has_power_query', False),
                'queries': pq_analysis.get('query_count', 0),
                'transformations': pq_analysis.get('all_transformations', []),
            },
            'formatting': {
                'score': fmt_analysis.get('score', 0),
                'has_cf': fmt_analysis.get('has_conditional_formatting', False),
                'has_dv': fmt_analysis.get('has_data_validation', False),
                'has_named_ranges': fmt_analysis.get('has_named_ranges', False),
            },
        }

        return grading_result

    # ------------------------------------------------------------------
    # Internal: DB persistence
    # ------------------------------------------------------------------

    def _get_existing_result(self, submission_id: int, submission_type: str):
        """Check for existing grading result."""
        from src.models.excel_grading_models import ExcelGradingResult

        if submission_type == 'assignment':
            return ExcelGradingResult.query.filter_by(
                assignment_submission_id=submission_id,
                submission_type='assignment',
            ).order_by(ExcelGradingResult.graded_at.desc()).first()
        else:
            return ExcelGradingResult.query.filter_by(
                project_submission_id=submission_id,
                submission_type='project',
            ).order_by(ExcelGradingResult.graded_at.desc()).first()

    def _save_result(
        self,
        submission_id: int,
        submission_type: str,
        student_id: int,
        course_id: int,
        file_info: Dict,
        grading_result: Dict[str, Any],
        feedback: str,
        processing_time: float,
    ):
        """Save grading result to database."""
        from src.models.user_models import db
        from src.models.excel_grading_models import ExcelGradingResult
        from .grading_engine import compute_grade_letter

        try:
            # Build rubric breakdown for strict JSON format
            breakdown = grading_result.get('rubric_breakdown', {})
            strict_breakdown = {}
            for key, data in breakdown.items():
                strict_breakdown[key] = {
                    'score': data.get('score', 0),
                    'max': data.get('max', 0),
                    'comment': data.get('comment', ''),
                }

            result = ExcelGradingResult(
                submission_type=submission_type,
                assignment_submission_id=submission_id if submission_type == 'assignment' else None,
                project_submission_id=submission_id if submission_type == 'project' else None,
                student_id=student_id,
                course_id=course_id,
                file_id=file_info.get('file_id'),
                file_name=file_info.get('original_filename') or file_info.get('filename'),
                file_size=file_info.get('size', 0),
                total_score=grading_result.get('total_score', 0),
                max_score=grading_result.get('max_score', 100),
                grade_letter=grading_result.get('grade', ''),
                rubric_breakdown=strict_breakdown,
                analysis_data=grading_result.get('analysis_data'),
                overall_feedback=feedback,
                confidence=grading_result.get('confidence', 'medium'),
                manual_review_required=grading_result.get('manual_review_required', True),
                flagged_issues=grading_result.get('flagged_issues'),
                graded_at=datetime.utcnow(),
                processing_time_seconds=processing_time,
                status='completed',
            )

            db.session.add(result)
            db.session.commit()

            logger.info(
                f"Excel grading saved: {submission_type} #{submission_id} → "
                f"{result.total_score}/{result.max_score} ({result.grade_letter})"
            )
            return result

        except Exception as e:
            logger.error(f"Failed to save grading result: {e}")
            db.session.rollback()
            return None
