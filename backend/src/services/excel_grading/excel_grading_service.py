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

            # Step 7: Parse assignment requirements (module-aware)
            module = self._load_module(assignment_or_project)
            requirements = self._parse_requirements(assignment_or_project, module)

            # Step 8: Get rubric — instructor → cached generated → generate new
            instructor_rubric = self._get_instructor_rubric(assignment_or_project, course)
            generated_rubric = None

            if not instructor_rubric:
                # Try to build / reuse a rubric from assignment instructions
                generated_rubric = self._get_or_generate_rubric(
                    assignment_or_project, course, module, requirements,
                )
                if generated_rubric:
                    # Merge generated rubric scope into requirements
                    gen_scope = generated_rubric.get('scope', {})
                    for key, val in gen_scope.items():
                        if val:  # only upgrade scope, never downgrade
                            requirements[key] = True
                    # Use the generated rubric as the instructor rubric
                    instructor_rubric = generated_rubric

            # Step 9: Get learning insights from past grading experience
            learning_insights = self._get_learning_insights(
                assignment_or_project, course, module,
            )

            # Step 10: Run the analysis pipeline (only relevant analyzers)
            grading_result = self._run_pipeline(
                file_bytes=file_bytes,
                file_name=file_info.get('original_filename') or file_info.get('filename', 'file.xlsx'),
                requirements=requirements,
                instructor_rubric=instructor_rubric,
            )

            # Step 11: Apply experience-based calibration
            if learning_insights and learning_insights.get('sample_size', 0) >= 3:
                grading_result = self._apply_learning_calibration(
                    grading_result, learning_insights,
                )

            # Step 12: Generate feedback
            feedback = grading_result.pop('feedback', '')

            # Step 13: Save to database
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

            # Step 14: Save generated rubric for future reuse
            if generated_rubric and db_result:
                self._cache_generated_rubric(
                    assignment_or_project, course, module, generated_rubric,
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
        """Load submission, parent (assignment/project), and course.

        Expires the SQLAlchemy session first so re-grade always reads
        the latest file data from the database.
        """
        from src.models.course_models import (
            Assignment, AssignmentSubmission, Project, ProjectSubmission, Course
        )
        from src.models.user_models import db

        # Ensure we read the latest data (critical for re-grades after resubmission)
        db.session.expire_all()

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

    def _load_module(self, assignment_or_project) -> Optional[Any]:
        """Load the module associated with an assignment or project."""
        from src.models.course_models import Module
        module_id = getattr(assignment_or_project, 'module_id', None)
        if module_id:
            return Module.query.get(module_id)
        return None

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
        """Extract file metadata from submission.

        Both assignment and project submissions may store files as a JSON
        array in their file column (file_url for assignments, file_path for
        projects).  We try JSON parsing first, then fall back to treating
        the value as a plain URL/path.
        """
        files = []

        if submission_type == 'assignment':
            raw = getattr(submission, 'file_url', None)
        else:
            raw = getattr(submission, 'file_path', None)

        if raw:
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    files.extend(parsed)
                elif isinstance(parsed, dict):
                    files.append(parsed)
                else:
                    # Unexpected JSON scalar — treat as URL
                    files.append({'url': str(parsed), 'filename': 'submission_file'})
            except (json.JSONDecodeError, TypeError):
                # Plain URL or path string
                fn = getattr(submission, 'file_name', None) or 'submission_file'
                files.append({
                    'url': raw,
                    'filename': fn,
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

    def _parse_requirements(self, assignment_or_project, module=None) -> Dict[str, Any]:
        """
        Parse assignment description/instructions + module context into
        machine-checkable requirements.  Now also determines the *scope*
        — which rubric categories are relevant for this specific assignment.
        """
        desc = (getattr(assignment_or_project, 'description', '') or '').lower()
        instructions = (getattr(assignment_or_project, 'instructions', '') or '').lower()
        title = (getattr(assignment_or_project, 'title', '') or '').lower()

        # Include module context if available
        module_title = ''
        module_desc = ''
        module_objectives = ''
        if module:
            module_title = (getattr(module, 'title', '') or '').lower()
            module_desc = (getattr(module, 'description', '') or '').lower()
            module_objectives = (getattr(module, 'learning_objectives', '') or '').lower()

        # Assignment-level text (primary)
        assignment_text = f"{title} {desc} {instructions}"
        # Module-level text (secondary context)
        module_text = f"{module_title} {module_desc} {module_objectives}"
        # Combined for broad keyword matching
        combined = f"{assignment_text} {module_text}"

        requirements: Dict[str, Any] = {}

        # ── Required functions detection ──────────────────────────────
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
            'sum ': 'SUM',
            'average': 'AVERAGE',
            'min ': 'MIN',
            'max ': 'MAX',
            'count': 'COUNT',
        }

        required_functions = []
        for keyword, func in function_keywords.items():
            if keyword in combined:
                if func not in required_functions:
                    required_functions.append(func)

        if required_functions:
            requirements['required_functions'] = required_functions

        # ── Feature scope detection ───────────────────────────────────
        # Determine what features are *relevant* for this assignment.
        # Only features explicitly mentioned in assignment instructions
        # or module context should be graded.  Everything else gets 0 weight.

        # Pivots: only if mentioned in assignment or module
        pivot_mentioned = any(
            kw in combined for kw in ['pivot table', 'pivottable', 'pivot chart', 'pivotchart']
        )
        requirements['require_pivots'] = pivot_mentioned
        requirements['scope_pivots'] = pivot_mentioned

        # Charts: only if mentioned
        chart_mentioned = any(
            kw in combined for kw in ['chart', 'graph', 'visualization', 'dashboard']
        )
        requirements['require_charts'] = chart_mentioned
        requirements['scope_charts'] = chart_mentioned

        # VBA: only if mentioned
        vba_mentioned = any(
            kw in combined for kw in ['vba', 'macro', 'automate', 'automation', 'programming']
        )
        requirements['require_vba'] = vba_mentioned
        requirements['scope_vba'] = vba_mentioned

        # Power Query: only if mentioned
        pq_mentioned = any(
            kw in combined for kw in ['power query', 'get & transform', 'm language', 'query editor', 'etl']
        )
        requirements['require_power_query'] = pq_mentioned
        requirements['scope_power_query'] = pq_mentioned

        # Conditional formatting
        cf_mentioned = any(
            kw in combined for kw in ['conditional format', 'highlight cells', 'data bars', 'color scale']
        )
        requirements['require_conditional_formatting'] = cf_mentioned

        # Data validation
        dv_mentioned = any(
            kw in combined for kw in ['data validation', 'dropdown', 'drop-down', 'validation rule']
        )
        requirements['require_data_validation'] = dv_mentioned

        # Formulas are ALWAYS in scope for Excel assignments
        requirements['scope_formulas'] = True
        # Formatting is always in scope (basic formatting matters)
        requirements['scope_formatting'] = True

        # ── Required sheets ───────────────────────────────────────────
        sheet_pattern = re.compile(
            r'(?:sheet|worksheet|tab)\s+(?:named?|called?|titled?)?\s*["\']?(\w[\w\s]*\w)["\']?',
            re.IGNORECASE
        )
        sheets = sheet_pattern.findall(combined)
        if sheets:
            requirements['required_sheets'] = [s.strip() for s in sheets]

        # ── Store raw context for feedback generator ──────────────────
        requirements['_assignment_title'] = getattr(assignment_or_project, 'title', '')
        requirements['_assignment_instructions'] = getattr(assignment_or_project, 'instructions', '') or ''
        requirements['_module_title'] = getattr(module, 'title', '') if module else ''
        requirements['_module_order'] = getattr(module, 'order', None) if module else None

        logger.info(
            f"Parsed requirements for '{requirements.get('_assignment_title', '?')}': "
            f"formulas={bool(required_functions)}, pivots={pivot_mentioned}, "
            f"charts={chart_mentioned}, vba={vba_mentioned}, pq={pq_mentioned}"
        )

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
    # Internal: Rubric generation & learning
    # ------------------------------------------------------------------

    def _get_or_generate_rubric(
        self,
        assignment_or_project,
        course,
        module,
        requirements: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """
        Try to get a cached rubric or generate a new one from instructions.

        Priority:
          1. Cached generated rubric (if instructions haven't changed)
          2. Freshly generated rubric from assignment instructions
          3. None (fall back to default scope-based rubric)
        """
        import hashlib
        from .rubric_generator import RubricGenerator
        from .learning_engine import LearningEngine

        title = getattr(assignment_or_project, 'title', '') or ''
        desc = getattr(assignment_or_project, 'description', '') or ''
        instructions = getattr(assignment_or_project, 'instructions', '') or ''
        assignment_id = getattr(assignment_or_project, 'id', 0)
        points = getattr(assignment_or_project, 'points_possible', 100) or 100

        # Short-circuit: if there are no meaningful instructions, skip
        if len(instructions.strip()) < 20 and len(desc.strip()) < 20:
            return None

        # Hash instructions to detect changes
        hash_input = f"{title}|{desc}|{instructions}".encode('utf-8')
        instructions_hash = hashlib.sha256(hash_input).hexdigest()[:16]

        # 1) Try cached rubric
        try:
            learning = LearningEngine()
            cached = learning.get_cached_rubric(assignment_id, instructions_hash)
            if cached:
                logger.info(f"Using cached generated rubric for assignment #{assignment_id}")
                return cached
        except Exception as e:
            logger.debug(f"Cache lookup failed: {e}")

        # 2) Generate fresh rubric from instructions
        try:
            generator = RubricGenerator(max_points=points)
            rubric = generator.generate(
                assignment_title=title,
                assignment_description=desc,
                assignment_instructions=instructions,
                module_title=getattr(module, 'title', '') if module else '',
                module_description=getattr(module, 'description', '') if module else '',
                module_objectives=getattr(module, 'learning_objectives', '') if module else '',
                points_possible=points,
            )

            if rubric and rubric.get('criteria'):
                rubric['_instructions_hash'] = instructions_hash
                logger.info(
                    f"Generated rubric for '{title}': "
                    f"{len(rubric['criteria'])} criteria, "
                    f"{rubric.get('task_count', 0)} tasks detected"
                )
                return rubric
        except Exception as e:
            logger.warning(f"Rubric generation failed: {e}")

        return None

    def _cache_generated_rubric(
        self,
        assignment_or_project,
        course,
        module,
        rubric: Dict[str, Any],
    ):
        """Save a generated rubric to the database for future reuse."""
        try:
            from .learning_engine import LearningEngine
            learning = LearningEngine()
            learning.save_generated_rubric(
                assignment_id=getattr(assignment_or_project, 'id', 0),
                course_id=course.id,
                module_id=getattr(module, 'id', None) if module else None,
                rubric_data=rubric,
                instructions_hash=rubric.get('_instructions_hash', ''),
            )
        except Exception as e:
            logger.debug(f"Could not cache generated rubric: {e}")

    def _get_learning_insights(self, assignment_or_project, course, module) -> Optional[Dict]:
        """Retrieve learning insights from past grading experiences."""
        try:
            from .learning_engine import LearningEngine
            learning = LearningEngine()
            return learning.get_insights(
                assignment_id=getattr(assignment_or_project, 'id', 0),
                course_id=course.id,
                module_id=getattr(module, 'id', None) if module else None,
            )
        except Exception as e:
            logger.debug(f"Could not get learning insights: {e}")
            return None

    def _apply_learning_calibration(
        self,
        grading_result: Dict[str, Any],
        insights: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Apply experience-based calibration to grading result."""
        try:
            from .learning_engine import LearningEngine
            learning = LearningEngine()
            return learning.apply_calibration(grading_result, insights)
        except Exception as e:
            logger.debug(f"Could not apply calibration: {e}")
            return grading_result

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
        """
        Run the analysis and grading pipeline.

        Only runs analyzers that are in scope for the current assignment
        (determined by ``requirements['scope_*']`` flags).  Out-of-scope
        analysers are skipped and an empty/default result is used instead,
        so the GradingEngine will assign 0 pts for those categories.
        """
        from .excel_analyzer import ExcelAnalyzer
        from .formula_analyzer import FormulaAnalyzer
        from .chart_analyzer import ChartAnalyzer
        from .pivot_analyzer import PivotAnalyzer
        from .vba_analyzer import VBAAnalyzer
        from .power_query_analyzer import PowerQueryAnalyzer
        from .formatting_analyzer import FormattingAnalyzer
        from .grading_engine import GradingEngine
        from .feedback_generator import FeedbackGenerator
        from .excel_mastery_levels import detect_mastery_level

        # Scope flags (default True for backward compat if flag is absent)
        scope_formulas = requirements.get('scope_formulas', True)
        scope_pivots = requirements.get('scope_pivots', False)
        scope_charts = requirements.get('scope_charts', False)
        scope_vba = requirements.get('scope_vba', False)
        scope_pq = requirements.get('scope_power_query', False)
        scope_formatting = requirements.get('scope_formatting', True)

        # 1. Workbook structure analysis — ALWAYS runs (needed by many others)
        wb_analyzer = ExcelAnalyzer(file_bytes, file_name)
        wb_analysis = wb_analyzer.analyze()

        # 2. Formula analysis — always (formulas always in scope)
        if scope_formulas:
            formula_analyzer = FormulaAnalyzer(wb_analysis)
            formula_analysis = formula_analyzer.analyze()
        else:
            formula_analysis = {'formula_count': 0, 'complexity_score': 0}

        # 3. Chart analysis — only if in scope
        if scope_charts:
            chart_analyzer = ChartAnalyzer(wb_analysis)
            chart_analysis = chart_analyzer.analyze()
        else:
            chart_analysis = {'chart_count': 0, 'chart_types': [], 'issues': []}

        # 4. Pivot Table analysis — only if in scope
        if scope_pivots:
            pivot_analyzer = PivotAnalyzer(file_bytes, wb_analysis)
            pivot_analysis = pivot_analyzer.analyze()
        else:
            pivot_analysis = {'pivot_count': 0, 'has_slicers': False, 'has_calculated_fields': False, 'pivots': []}

        # 5. VBA analysis — only if in scope
        if scope_vba:
            vba_analyzer = VBAAnalyzer(file_bytes, wb_analysis)
            vba_analysis = vba_analyzer.analyze()
        else:
            vba_analysis = {'has_vba': False, 'module_count': 0, 'total_procedures': 0, 'total_lines': 0, 'security': {}, 'code_quality': {}, 'automation_patterns': []}

        # 6. Power Query analysis — only if in scope
        if scope_pq:
            pq_analyzer = PowerQueryAnalyzer(file_bytes, wb_analysis)
            pq_analysis = pq_analyzer.analyze()
        else:
            pq_analysis = {'has_power_query': False, 'query_count': 0, 'all_transformations': [], 'total_steps': 0, 'queries': []}

        # 7. Formatting analysis — always (basic formatting matters)
        if scope_formatting:
            fmt_analyzer = FormattingAnalyzer(wb_analysis)
            fmt_analysis = fmt_analyzer.analyze()
        else:
            fmt_analysis = {'score': 0}

        logger.info(
            f"Pipeline ran analyzers: formulas={scope_formulas}, pivots={scope_pivots}, "
            f"charts={scope_charts}, vba={scope_vba}, pq={scope_pq}, fmt={scope_formatting}"
        )

        # 7b. Detect mastery level from module/assignment metadata
        mastery_level = detect_mastery_level(
            module_title=requirements.get('_module_title', ''),
            assignment_title=requirements.get('_assignment_title', ''),
            assignment_instructions=requirements.get('_assignment_instructions', ''),
            module_order=requirements.get('_module_order'),
        )
        logger.info(
            f"Mastery level detected: {mastery_level['level_id']} "
            f"(confidence={mastery_level['confidence']}, "
            f"score={mastery_level.get('match_score', 0)})"
        )

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
            mastery_level=mastery_level,
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
            assignment_title=requirements.get('_assignment_title', file_name),
            module_title=requirements.get('_module_title', ''),
            assignment_instructions=requirements.get('_assignment_instructions', ''),
            mastery_level=mastery_level,
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
            'mastery_level': {
                'level_id': mastery_level.get('level_id', 'intermediate'),
                'level_name': mastery_level.get('level_name', 'Intermediate'),
                'level_number': mastery_level.get('level_number', 2),
                'confidence': mastery_level.get('confidence', 'medium'),
                'match_score': mastery_level.get('match_score', 0),
                'matched_keywords': mastery_level.get('matched_keywords', []),
            },
            'strengths': grading_result.get('strengths', []),
            'weaknesses': grading_result.get('weaknesses', []),
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
        """Save grading result to database.

        If a previous result exists for the same submission, DELETE it first
        so only one authoritative result exists — prevents score mismatch
        between student and instructor views.
        """
        from src.models.user_models import db
        from src.models.excel_grading_models import ExcelGradingResult
        from .grading_engine import compute_grade_letter

        try:
            # ── Remove any previous results for this submission ──────
            if submission_type == 'assignment':
                old_results = ExcelGradingResult.query.filter_by(
                    assignment_submission_id=submission_id,
                    submission_type='assignment',
                ).all()
            else:
                old_results = ExcelGradingResult.query.filter_by(
                    project_submission_id=submission_id,
                    submission_type='project',
                ).all()

            if old_results:
                for old in old_results:
                    db.session.delete(old)
                logger.info(
                    f"Deleted {len(old_results)} old grading result(s) for "
                    f"{submission_type} #{submission_id} before re-grade"
                )

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
