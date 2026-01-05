"""
Task-Based Lesson Generation Module
Generates comprehensive lesson content using a multi-task approach with deep research,
planning, and iterative content generation to create professor-level educational materials.

This module breaks lesson generation into discrete tasks:
1. Research & Analysis Phase - Deep topic exploration
2. Planning Phase - Structure and curriculum design  
3. Content Generation Phase - Section-by-section with sub-tasks
4. Enhancement Phase - Examples, analogies, visual descriptions
5. Validation Phase - Quality assurance and refinement

Features:
- Task caching for resumption from failed tasks
- Parallel execution of independent tasks
- Session-based state management
- Real-time progress callbacks

Each task is independent and makes focused AI calls to avoid token limits
while generating more detailed, in-depth content.
"""

import time
import json
import uuid
import hashlib
import logging
import threading
from typing import Dict, List, Optional, Any, Callable, Tuple
from datetime import datetime
from enum import Enum
from dataclasses import dataclass, field, asdict
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor, as_completed

from .ai_providers import ai_provider_manager
from .json_parser import json_parser
from .content_validator import ContentValidator
from .fallback_generators import fallback_generators

logger = logging.getLogger(__name__)


class TaskStatus(Enum):
    """Task execution status"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class TaskType(Enum):
    """Types of lesson generation tasks"""
    # Research Phase
    TOPIC_ANALYSIS = "topic_analysis"
    CONCEPT_MAPPING = "concept_mapping"
    PREREQUISITE_ANALYSIS = "prerequisite_analysis"
    LEARNING_PATH_DESIGN = "learning_path_design"
    
    # Planning Phase
    LESSON_OUTLINE = "lesson_outline"
    LEARNING_OBJECTIVES = "learning_objectives"
    SECTION_PLANNING = "section_planning"
    ASSESSMENT_PLANNING = "assessment_planning"
    
    # Content Generation Phase - Introduction
    HOOK_GENERATION = "hook_generation"
    CONTEXT_SETTING = "context_setting"
    MOTIVATION_SECTION = "motivation_section"
    OVERVIEW_SECTION = "overview_section"
    
    # Content Generation Phase - Theory
    DEFINITIONS_CORE = "definitions_core"
    PRINCIPLES_FUNDAMENTALS = "principles_fundamentals"
    THEORETICAL_FRAMEWORKS = "theoretical_frameworks"
    CONCEPT_CONNECTIONS = "concept_connections"
    HISTORICAL_CONTEXT = "historical_context"
    ADVANCED_CONSIDERATIONS = "advanced_considerations"
    
    # Content Generation Phase - Practical
    USE_CASES_REAL_WORLD = "use_cases_real_world"
    WORKED_EXAMPLES = "worked_examples"
    CODE_EXAMPLES = "code_examples"
    BEST_PRACTICES = "best_practices"
    COMMON_PITFALLS = "common_pitfalls"
    CASE_STUDIES = "case_studies"
    
    # Content Generation Phase - Exercises
    CONCEPT_CHECK_QUESTIONS = "concept_check_questions"
    APPLIED_PROBLEMS = "applied_problems"
    CRITICAL_THINKING = "critical_thinking"
    HANDS_ON_ACTIVITIES = "hands_on_activities"
    SELF_ASSESSMENT = "self_assessment"
    
    # Content Generation Phase - Summary
    KEY_TAKEAWAYS = "key_takeaways"
    REFLECTION_QUESTIONS = "reflection_questions"
    NEXT_STEPS = "next_steps"
    ADDITIONAL_RESOURCES = "additional_resources"
    
    # Enhancement Phase
    ANALOGY_GENERATION = "analogy_generation"
    VISUAL_DESCRIPTIONS = "visual_descriptions"
    EXAMPLE_ENRICHMENT = "example_enrichment"
    CONCEPT_BRIDGES = "concept_bridges"
    
    # Validation Phase
    CONTENT_REVIEW = "content_review"
    QUALITY_ASSURANCE = "quality_assurance"


@dataclass
class LessonTask:
    """Represents a single task in lesson generation"""
    task_id: str
    task_type: TaskType
    title: str
    description: str
    dependencies: List[str] = field(default_factory=list)
    status: TaskStatus = TaskStatus.PENDING
    result: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    execution_time: float = 0.0
    retry_count: int = 0
    max_retries: int = 2
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize task to dictionary for caching"""
        return {
            "task_id": self.task_id,
            "task_type": self.task_type.value,
            "title": self.title,
            "description": self.description,
            "dependencies": self.dependencies,
            "status": self.status.value,
            "result": self.result,
            "metadata": self.metadata,
            "execution_time": self.execution_time,
            "retry_count": self.retry_count,
            "max_retries": self.max_retries
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'LessonTask':
        """Deserialize task from dictionary"""
        return cls(
            task_id=data["task_id"],
            task_type=TaskType(data["task_type"]),
            title=data["title"],
            description=data["description"],
            dependencies=data.get("dependencies", []),
            status=TaskStatus(data.get("status", "pending")),
            result=data.get("result"),
            metadata=data.get("metadata", {}),
            execution_time=data.get("execution_time", 0.0),
            retry_count=data.get("retry_count", 0),
            max_retries=data.get("max_retries", 2)
        )


class GenerationSession:
    """
    Manages a lesson generation session with caching and resumption support.
    
    Sessions track:
    - Generation context (course, module, lesson details)
    - Task states and results
    - Progress information
    - Timing data
    """
    
    def __init__(self, session_id: Optional[str] = None):
        self.session_id = session_id or str(uuid.uuid4())
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
        self.status = "initialized"
        self.context: Dict[str, Any] = {}
        self.tasks: OrderedDict[str, LessonTask] = OrderedDict()
        self.task_results: Dict[str, Any] = {}
        self.progress: Dict[str, Any] = {
            "total_tasks": 0,
            "completed_tasks": 0,
            "failed_tasks": 0,
            "current_task": None,
            "percentage": 0
        }
        self.timing: Dict[str, float] = {
            "start_time": 0,
            "elapsed_time": 0
        }
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize session to dictionary for caching"""
        return {
            "session_id": self.session_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "status": self.status,
            "context": self.context,
            "tasks": {k: v.to_dict() for k, v in self.tasks.items()},
            "task_results": self.task_results,
            "progress": self.progress,
            "timing": self.timing
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'GenerationSession':
        """Deserialize session from dictionary"""
        session = cls(session_id=data["session_id"])
        session.created_at = datetime.fromisoformat(data["created_at"])
        session.updated_at = datetime.fromisoformat(data["updated_at"])
        session.status = data["status"]
        session.context = data["context"]
        session.tasks = OrderedDict(
            (k, LessonTask.from_dict(v)) for k, v in data.get("tasks", {}).items()
        )
        session.task_results = data.get("task_results", {})
        session.progress = data.get("progress", {})
        session.timing = data.get("timing", {})
        return session
    
    def get_pending_tasks(self) -> List[str]:
        """Get list of task IDs that are pending or failed (can be retried)"""
        return [
            task_id for task_id, task in self.tasks.items()
            if task.status in [TaskStatus.PENDING, TaskStatus.FAILED]
            and task.retry_count < task.max_retries
        ]
    
    def get_independent_tasks(self) -> List[str]:
        """Get list of task IDs that can run in parallel (dependencies met)"""
        ready_tasks = []
        completed_ids = {
            task_id for task_id, task in self.tasks.items()
            if task.status == TaskStatus.COMPLETED
        }
        
        for task_id, task in self.tasks.items():
            if task.status != TaskStatus.PENDING:
                continue
            # Check if all dependencies are completed
            if all(dep in completed_ids for dep in task.dependencies):
                ready_tasks.append(task_id)
        
        return ready_tasks


class SessionCache:
    """
    In-memory cache for generation sessions.
    Allows resuming from failed tasks and tracking progress.
    """
    
    def __init__(self, max_sessions: int = 100, ttl_hours: int = 24):
        self._cache: Dict[str, GenerationSession] = {}
        self._lock = threading.Lock()
        self.max_sessions = max_sessions
        self.ttl_hours = ttl_hours
    
    def create_session(self, context: Dict[str, Any]) -> GenerationSession:
        """Create a new generation session"""
        session = GenerationSession()
        session.context = context
        session.status = "created"
        
        with self._lock:
            # Cleanup old sessions if at capacity
            if len(self._cache) >= self.max_sessions:
                self._cleanup_old_sessions()
            self._cache[session.session_id] = session
        
        return session
    
    def get_session(self, session_id: str) -> Optional[GenerationSession]:
        """Get a session by ID"""
        with self._lock:
            return self._cache.get(session_id)
    
    def update_session(self, session: GenerationSession):
        """Update a session in the cache"""
        session.updated_at = datetime.now()
        with self._lock:
            self._cache[session.session_id] = session
    
    def delete_session(self, session_id: str):
        """Delete a session from the cache"""
        with self._lock:
            if session_id in self._cache:
                del self._cache[session_id]
    
    def _cleanup_old_sessions(self):
        """Remove expired sessions"""
        now = datetime.now()
        expired = [
            sid for sid, session in self._cache.items()
            if (now - session.updated_at).total_seconds() > self.ttl_hours * 3600
        ]
        for sid in expired:
            del self._cache[sid]
        
        # If still at capacity, remove oldest
        if len(self._cache) >= self.max_sessions:
            oldest = min(self._cache.items(), key=lambda x: x[1].updated_at)
            del self._cache[oldest[0]]
    
    def get_all_sessions(self) -> List[Dict[str, Any]]:
        """Get summary of all active sessions"""
        with self._lock:
            return [
                {
                    "session_id": s.session_id,
                    "status": s.status,
                    "lesson_title": s.context.get("lesson_title", "Unknown"),
                    "progress": s.progress,
                    "created_at": s.created_at.isoformat(),
                    "updated_at": s.updated_at.isoformat()
                }
                for s in self._cache.values()
            ]


# Global session cache
session_cache = SessionCache()


class TaskBasedLessonGenerator:
    """
    Generates comprehensive lessons using a task-based approach.
    
    Features:
    - Multi-task generation for in-depth content
    - Session caching for resumption from failures
    - Parallel execution of independent tasks
    - Real-time progress callbacks
    
    This generator breaks down lesson creation into multiple focused tasks,
    each making independent AI calls to generate detailed, in-depth content
    while avoiding token limits.
    """
    
    # Maximum parallel tasks (limited by rate limiting)
    MAX_PARALLEL_TASKS = 3
    
    def __init__(self, provider_manager=None):
        self.provider = provider_manager or ai_provider_manager
        self.validator = ContentValidator()
        self.tasks: OrderedDict[str, LessonTask] = OrderedDict()
        self.task_results: Dict[str, Any] = {}
        self.generation_context: Dict[str, Any] = {}
        self._current_session: Optional[GenerationSession] = None
        self._executor: Optional[ThreadPoolExecutor] = None
        self._progress_callback: Optional[Callable] = None
        self._lock = threading.Lock()
    
    def create_session(
        self,
        course_title: str,
        module_title: str,
        module_description: str,
        module_objectives: str,
        lesson_title: str,
        lesson_description: str = "",
        difficulty_level: str = "intermediate",
        existing_lessons: Optional[List[Dict[str, Any]]] = None,
        depth_level: str = "comprehensive"
    ) -> str:
        """
        Create a new generation session without starting execution.
        
        Returns:
            Session ID that can be used to start/resume generation
        """
        context = {
            "course_title": course_title,
            "module_title": module_title,
            "module_description": module_description,
            "module_objectives": module_objectives,
            "lesson_title": lesson_title,
            "lesson_description": lesson_description,
            "difficulty_level": difficulty_level,
            "existing_lessons": existing_lessons or [],
            "depth_level": depth_level,
        }
        
        session = session_cache.create_session(context)
        
        # Build tasks for the session
        self.generation_context = context
        self._build_task_queue(depth_level)
        session.tasks = self.tasks.copy()
        session.progress["total_tasks"] = len(session.tasks)
        session_cache.update_session(session)
        
        logger.info(f"Created session {session.session_id} for lesson: {lesson_title}")
        return session.session_id
    
    def get_session_status(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get the current status of a generation session"""
        session = session_cache.get_session(session_id)
        if not session:
            return None
        
        return {
            "session_id": session.session_id,
            "status": session.status,
            "lesson_title": session.context.get("lesson_title"),
            "progress": session.progress,
            "timing": session.timing,
            "tasks": {
                task_id: {
                    "title": task.title,
                    "status": task.status.value,
                    "execution_time": task.execution_time
                }
                for task_id, task in session.tasks.items()
            }
        }
    
    def resume_session(
        self,
        session_id: str,
        progress_callback: Optional[Callable] = None,
        parallel: bool = True
    ) -> Dict[str, Any]:
        """
        Resume a generation session from where it left off.
        
        Args:
            session_id: ID of the session to resume
            progress_callback: Callback for progress updates
            parallel: Whether to execute independent tasks in parallel
            
        Returns:
            Dict with complete lesson content and generation report
        """
        session = session_cache.get_session(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")
        
        logger.info(f"Resuming session {session_id} for lesson: {session.context.get('lesson_title')}")
        
        # Restore state
        self.generation_context = session.context
        self.tasks = session.tasks
        self.task_results = session.task_results
        self._current_session = session
        self._progress_callback = progress_callback
        
        session.status = "running"
        session.timing["start_time"] = time.time()
        session_cache.update_session(session)
        
        # Execute remaining tasks
        if parallel:
            self._execute_tasks_parallel(session)
        else:
            self._execute_tasks_sequential(session)
        
        # Assemble final lesson
        complete_lesson = self._assemble_lesson_from_tasks()
        generation_report = self._generate_report(session.timing["start_time"])
        
        session.status = "completed"
        session.progress["percentage"] = 100
        session_cache.update_session(session)
        
        if progress_callback:
            progress_callback(
                session.progress["completed_tasks"],
                session.progress["total_tasks"],
                "completed",
                f"Lesson generated! Tasks: {session.progress['completed_tasks']}/{session.progress['total_tasks']}"
            )
        
        return {
            **complete_lesson,
            "session_id": session_id,
            "generation_report": generation_report,
            "task_details": {
                task_id: {
                    "title": task.title,
                    "status": task.status.value,
                    "execution_time": task.execution_time
                }
                for task_id, task in self.tasks.items()
            }
        }
    
    def generate_lesson_with_tasks(
        self,
        course_title: str,
        module_title: str,
        module_description: str,
        module_objectives: str,
        lesson_title: str,
        lesson_description: str = "",
        difficulty_level: str = "intermediate",
        existing_lessons: Optional[List[Dict[str, Any]]] = None,
        depth_level: str = "comprehensive",
        progress_callback: Optional[Callable] = None,
        parallel: bool = True,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive lesson using task-based approach.
        
        Args:
            course_title: Parent course title
            module_title: Parent module title
            module_description: Module description for context
            module_objectives: Module learning objectives
            lesson_title: Lesson title
            lesson_description: Brief lesson description
            difficulty_level: beginner, intermediate, advanced
            existing_lessons: List of existing lessons for context
            depth_level: How deep to go - basic (5 tasks), standard (12 tasks), 
                        comprehensive (20 tasks), expert (30+ tasks)
            progress_callback: Callback for progress updates
            parallel: Whether to execute independent tasks in parallel
            session_id: Optional session ID to resume from
            
        Returns:
            Dict with complete lesson content, session_id, and generation report
        """
        # Resume existing session if provided
        if session_id:
            return self.resume_session(session_id, progress_callback, parallel)
        
        logger.info(f"Starting task-based lesson generation: {lesson_title} (depth: {depth_level}, parallel: {parallel})")
        
        # Create new session
        new_session_id = self.create_session(
            course_title, module_title, module_description, module_objectives,
            lesson_title, lesson_description, difficulty_level, existing_lessons, depth_level
        )
        
        # Execute and return
        return self.resume_session(new_session_id, progress_callback, parallel)
    
    def _execute_tasks_parallel(self, session: GenerationSession):
        """Execute tasks in parallel where dependencies allow"""
        with ThreadPoolExecutor(max_workers=self.MAX_PARALLEL_TASKS) as executor:
            while True:
                # Get tasks that can run in parallel
                ready_tasks = session.get_independent_tasks()
                
                if not ready_tasks:
                    # Check if there are still pending tasks
                    pending = session.get_pending_tasks()
                    if not pending:
                        break
                    # If there are pending but none ready, there might be dependency issues
                    logger.warning(f"No ready tasks but {len(pending)} pending - checking for issues")
                    break
                
                # Submit tasks for parallel execution
                futures = {}
                for task_id in ready_tasks[:self.MAX_PARALLEL_TASKS]:
                    task = session.tasks[task_id]
                    task.status = TaskStatus.IN_PROGRESS
                    session_cache.update_session(session)
                    
                    future = executor.submit(self._execute_single_task, task, session)
                    futures[future] = task_id
                
                # Wait for batch to complete
                for future in as_completed(futures):
                    task_id = futures[future]
                    try:
                        success = future.result()
                        if success:
                            session.progress["completed_tasks"] += 1
                        else:
                            session.progress["failed_tasks"] += 1
                        
                        # Update progress
                        total = session.progress["total_tasks"]
                        completed = session.progress["completed_tasks"]
                        session.progress["percentage"] = int((completed / total) * 100) if total > 0 else 0
                        session_cache.update_session(session)
                        
                        if self._progress_callback:
                            task = session.tasks[task_id]
                            self._progress_callback(
                                completed, total,
                                "running" if completed < total else "completed",
                                f"Completed: {task.title}"
                            )
                    except Exception as e:
                        logger.error(f"Task {task_id} failed with exception: {e}")
                        session.tasks[task_id].status = TaskStatus.FAILED
                        session.progress["failed_tasks"] += 1
    
    def _execute_tasks_sequential(self, session: GenerationSession):
        """Execute tasks sequentially in dependency order"""
        for task_id, task in session.tasks.items():
            # Skip already completed tasks (for resumption)
            if task.status == TaskStatus.COMPLETED:
                continue
            
            # Check dependencies
            if not self._check_dependencies_for_session(task, session):
                task.status = TaskStatus.SKIPPED
                logger.warning(f"Skipping task {task_id} - dependencies not met")
                continue
            
            # Update progress
            session.progress["current_task"] = task_id
            session_cache.update_session(session)
            
            if self._progress_callback:
                self._progress_callback(
                    session.progress["completed_tasks"],
                    session.progress["total_tasks"],
                    "running", f"Task: {task.title}"
                )
            
            # Execute task
            success = self._execute_single_task(task, session)
            
            if success:
                session.progress["completed_tasks"] += 1
            else:
                session.progress["failed_tasks"] += 1
            
            # Update progress percentage
            total = session.progress["total_tasks"]
            completed = session.progress["completed_tasks"]
            session.progress["percentage"] = int((completed / total) * 100) if total > 0 else 0
            session_cache.update_session(session)
    
    def _execute_single_task(self, task: LessonTask, session: GenerationSession) -> bool:
        """Execute a single task and return success status"""
        task.status = TaskStatus.IN_PROGRESS
        logger.info(f"Executing task: {task.title} ({task.task_id})")
        
        try:
            task_start = time.time()
            result = self._execute_task(task)
            task.execution_time = time.time() - task_start
            
            if result:
                task.result = result
                task.status = TaskStatus.COMPLETED
                session.task_results[task.task_id] = result
                self.task_results[task.task_id] = result
                logger.info(f"Task completed: {task.title} ({task.execution_time:.2f}s)")
                return True
            else:
                task.status = TaskStatus.FAILED
                task.retry_count += 1
                logger.warning(f"Task failed: {task.title}")
                return False
                
        except Exception as e:
            task.status = TaskStatus.FAILED
            task.retry_count += 1
            logger.error(f"Task error: {task.title} - {str(e)}")
            return False
    
    def _check_dependencies_for_session(self, task: LessonTask, session: GenerationSession) -> bool:
        """Check if all task dependencies are completed within a session"""
        for dep_id in task.dependencies:
            if dep_id not in session.tasks:
                continue
            dep_task = session.tasks[dep_id]
            if dep_task.status not in [TaskStatus.COMPLETED, TaskStatus.SKIPPED]:
                return False
        return True
    
    def _build_task_queue(self, depth_level: str):
        """Build the task queue based on depth level"""
        self.tasks.clear()
        self.task_results.clear()
        
        # Phase 1: Research (always included)
        self._add_research_tasks(depth_level)
        
        # Phase 2: Planning
        self._add_planning_tasks(depth_level)
        
        # Phase 3: Content Generation
        self._add_content_generation_tasks(depth_level)
        
        # Phase 4: Enhancement (for comprehensive and expert)
        if depth_level in ["comprehensive", "expert"]:
            self._add_enhancement_tasks(depth_level)
        
        # Phase 5: Validation (for standard and above)
        if depth_level in ["standard", "comprehensive", "expert"]:
            self._add_validation_tasks(depth_level)
    
    def _add_research_tasks(self, depth_level: str):
        """Add research phase tasks"""
        # Topic Analysis - Always included
        self.tasks["research_topic"] = LessonTask(
            task_id="research_topic",
            task_type=TaskType.TOPIC_ANALYSIS,
            title="Analyze Topic Depth",
            description="Deep analysis of the lesson topic, identifying key aspects and scope"
        )
        
        # Concept Mapping - For standard and above
        if depth_level in ["standard", "comprehensive", "expert"]:
            self.tasks["research_concepts"] = LessonTask(
                task_id="research_concepts",
                task_type=TaskType.CONCEPT_MAPPING,
                title="Map Key Concepts",
                description="Identify and map relationships between key concepts",
                dependencies=["research_topic"]
            )
        
        # Prerequisite Analysis - For comprehensive and expert
        if depth_level in ["comprehensive", "expert"]:
            self.tasks["research_prerequisites"] = LessonTask(
                task_id="research_prerequisites",
                task_type=TaskType.PREREQUISITE_ANALYSIS,
                title="Analyze Prerequisites",
                description="Identify what learners need to know before this lesson",
                dependencies=["research_topic"]
            )
        
        # Learning Path Design - For expert only
        if depth_level == "expert":
            self.tasks["research_learning_path"] = LessonTask(
                task_id="research_learning_path",
                task_type=TaskType.LEARNING_PATH_DESIGN,
                title="Design Learning Path",
                description="Design optimal learning path and cognitive load distribution",
                dependencies=["research_concepts", "research_prerequisites"]
            )
    
    def _add_planning_tasks(self, depth_level: str):
        """Add planning phase tasks"""
        # Lesson Outline - Always included
        self.tasks["plan_outline"] = LessonTask(
            task_id="plan_outline",
            task_type=TaskType.LESSON_OUTLINE,
            title="Create Lesson Outline",
            description="Create detailed lesson outline with section structure",
            dependencies=["research_topic"]
        )
        
        # Learning Objectives - Always included
        self.tasks["plan_objectives"] = LessonTask(
            task_id="plan_objectives",
            task_type=TaskType.LEARNING_OBJECTIVES,
            title="Define Learning Objectives",
            description="Define specific, measurable learning objectives using Bloom's Taxonomy",
            dependencies=["plan_outline"]
        )
        
        # Section Planning - For standard and above
        if depth_level in ["standard", "comprehensive", "expert"]:
            self.tasks["plan_sections"] = LessonTask(
                task_id="plan_sections",
                task_type=TaskType.SECTION_PLANNING,
                title="Plan Section Details",
                description="Plan detailed content for each section",
                dependencies=["plan_outline", "plan_objectives"]
            )
        
        # Assessment Planning - For comprehensive and expert
        if depth_level in ["comprehensive", "expert"]:
            self.tasks["plan_assessment"] = LessonTask(
                task_id="plan_assessment",
                task_type=TaskType.ASSESSMENT_PLANNING,
                title="Plan Assessments",
                description="Plan quizzes, exercises, and assessment strategies",
                dependencies=["plan_objectives"]
            )
    
    def _add_content_generation_tasks(self, depth_level: str):
        """Add content generation phase tasks"""
        # Get dependencies based on what was added
        base_deps = ["plan_outline", "plan_objectives"]
        if depth_level in ["standard", "comprehensive", "expert"]:
            base_deps.append("plan_sections")
        
        # === INTRODUCTION SECTION ===
        if depth_level == "basic":
            # Single combined introduction task
            self.tasks["content_introduction"] = LessonTask(
                task_id="content_introduction",
                task_type=TaskType.HOOK_GENERATION,
                title="Generate Introduction",
                description="Generate complete introduction section",
                dependencies=base_deps
            )
        else:
            # Split introduction into sub-tasks
            self.tasks["content_hook"] = LessonTask(
                task_id="content_hook",
                task_type=TaskType.HOOK_GENERATION,
                title="Create Engaging Hook",
                description="Generate an engaging hook to capture learner attention",
                dependencies=base_deps
            )
            
            self.tasks["content_context"] = LessonTask(
                task_id="content_context",
                task_type=TaskType.CONTEXT_SETTING,
                title="Set Learning Context",
                description="Establish context and relevance of the topic",
                dependencies=["content_hook"]
            )
            
            if depth_level in ["comprehensive", "expert"]:
                self.tasks["content_motivation"] = LessonTask(
                    task_id="content_motivation",
                    task_type=TaskType.MOTIVATION_SECTION,
                    title="Create Motivation Section",
                    description="Explain why this topic matters with real-world applications",
                    dependencies=["content_context"]
                )
                
                self.tasks["content_overview"] = LessonTask(
                    task_id="content_overview",
                    task_type=TaskType.OVERVIEW_SECTION,
                    title="Write Lesson Overview",
                    description="Provide roadmap of what will be covered",
                    dependencies=["content_motivation"]
                )
        
        # === THEORY SECTION ===
        theory_deps = ["content_introduction"] if depth_level == "basic" else ["content_context"]
        if depth_level in ["comprehensive", "expert"]:
            theory_deps = ["content_overview"]
        
        if depth_level == "basic":
            self.tasks["content_theory"] = LessonTask(
                task_id="content_theory",
                task_type=TaskType.DEFINITIONS_CORE,
                title="Generate Theory Content",
                description="Generate complete theoretical foundation",
                dependencies=theory_deps
            )
        else:
            # Split theory into sub-tasks
            self.tasks["content_definitions"] = LessonTask(
                task_id="content_definitions",
                task_type=TaskType.DEFINITIONS_CORE,
                title="Write Core Definitions",
                description="Define key terms and concepts with precision",
                dependencies=theory_deps
            )
            
            self.tasks["content_principles"] = LessonTask(
                task_id="content_principles",
                task_type=TaskType.PRINCIPLES_FUNDAMENTALS,
                title="Explain Fundamental Principles",
                description="Explain the fundamental principles and rules",
                dependencies=["content_definitions"]
            )
            
            if depth_level in ["comprehensive", "expert"]:
                self.tasks["content_frameworks"] = LessonTask(
                    task_id="content_frameworks",
                    task_type=TaskType.THEORETICAL_FRAMEWORKS,
                    title="Present Theoretical Frameworks",
                    description="Present academic frameworks and models",
                    dependencies=["content_principles"]
                )
                
                self.tasks["content_connections"] = LessonTask(
                    task_id="content_connections",
                    task_type=TaskType.CONCEPT_CONNECTIONS,
                    title="Show Concept Connections",
                    description="Show how concepts relate to each other and prior knowledge",
                    dependencies=["content_frameworks"]
                )
            
            if depth_level == "expert":
                self.tasks["content_history"] = LessonTask(
                    task_id="content_history",
                    task_type=TaskType.HISTORICAL_CONTEXT,
                    title="Add Historical Context",
                    description="Provide historical development and evolution of concepts",
                    dependencies=["content_frameworks"]
                )
                
                self.tasks["content_advanced"] = LessonTask(
                    task_id="content_advanced",
                    task_type=TaskType.ADVANCED_CONSIDERATIONS,
                    title="Discuss Advanced Considerations",
                    description="Cover edge cases, limitations, and advanced topics",
                    dependencies=["content_connections"]
                )
        
        # === PRACTICAL SECTION ===
        practical_deps = ["content_theory"] if depth_level == "basic" else ["content_principles"]
        if depth_level in ["comprehensive", "expert"]:
            practical_deps = ["content_connections"]
        if depth_level == "expert":
            practical_deps = ["content_advanced"]
        
        if depth_level == "basic":
            self.tasks["content_practical"] = LessonTask(
                task_id="content_practical",
                task_type=TaskType.USE_CASES_REAL_WORLD,
                title="Generate Practical Content",
                description="Generate practical examples and applications",
                dependencies=practical_deps
            )
        else:
            self.tasks["content_use_cases"] = LessonTask(
                task_id="content_use_cases",
                task_type=TaskType.USE_CASES_REAL_WORLD,
                title="Present Real-World Use Cases",
                description="Show real-world applications and use cases",
                dependencies=practical_deps
            )
            
            self.tasks["content_worked_examples"] = LessonTask(
                task_id="content_worked_examples",
                task_type=TaskType.WORKED_EXAMPLES,
                title="Create Worked Examples",
                description="Provide step-by-step worked examples with explanations",
                dependencies=["content_use_cases"]
            )
            
            if depth_level in ["comprehensive", "expert"]:
                self.tasks["content_code"] = LessonTask(
                    task_id="content_code",
                    task_type=TaskType.CODE_EXAMPLES,
                    title="Write Code Examples",
                    description="Create code examples with detailed comments",
                    dependencies=["content_worked_examples"]
                )
                
                self.tasks["content_best_practices"] = LessonTask(
                    task_id="content_best_practices",
                    task_type=TaskType.BEST_PRACTICES,
                    title="Document Best Practices",
                    description="Document industry best practices and standards",
                    dependencies=["content_code"]
                )
                
                self.tasks["content_pitfalls"] = LessonTask(
                    task_id="content_pitfalls",
                    task_type=TaskType.COMMON_PITFALLS,
                    title="Warn About Common Pitfalls",
                    description="Highlight common mistakes and how to avoid them",
                    dependencies=["content_best_practices"]
                )
            
            if depth_level == "expert":
                self.tasks["content_case_studies"] = LessonTask(
                    task_id="content_case_studies",
                    task_type=TaskType.CASE_STUDIES,
                    title="Present Case Studies",
                    description="Present detailed case studies with analysis",
                    dependencies=["content_pitfalls"]
                )
        
        # === EXERCISES SECTION ===
        exercise_deps = ["content_practical"] if depth_level == "basic" else ["content_worked_examples"]
        if depth_level in ["comprehensive", "expert"]:
            exercise_deps = ["content_pitfalls"]
        if depth_level == "expert":
            exercise_deps = ["content_case_studies"]
        
        if depth_level == "basic":
            self.tasks["content_exercises"] = LessonTask(
                task_id="content_exercises",
                task_type=TaskType.CONCEPT_CHECK_QUESTIONS,
                title="Generate Exercises",
                description="Generate practice exercises",
                dependencies=exercise_deps
            )
        else:
            self.tasks["content_concept_checks"] = LessonTask(
                task_id="content_concept_checks",
                task_type=TaskType.CONCEPT_CHECK_QUESTIONS,
                title="Create Concept Check Questions",
                description="Create questions to verify understanding",
                dependencies=exercise_deps
            )
            
            self.tasks["content_applied_problems"] = LessonTask(
                task_id="content_applied_problems",
                task_type=TaskType.APPLIED_PROBLEMS,
                title="Design Applied Problems",
                description="Create problems requiring application of concepts",
                dependencies=["content_concept_checks"]
            )
            
            if depth_level in ["comprehensive", "expert"]:
                self.tasks["content_critical_thinking"] = LessonTask(
                    task_id="content_critical_thinking",
                    task_type=TaskType.CRITICAL_THINKING,
                    title="Add Critical Thinking Challenges",
                    description="Create challenges requiring analysis and evaluation",
                    dependencies=["content_applied_problems"]
                )
                
                self.tasks["content_hands_on"] = LessonTask(
                    task_id="content_hands_on",
                    task_type=TaskType.HANDS_ON_ACTIVITIES,
                    title="Create Hands-On Activities",
                    description="Design practical, hands-on activities",
                    dependencies=["content_critical_thinking"]
                )
            
            if depth_level == "expert":
                self.tasks["content_self_assessment"] = LessonTask(
                    task_id="content_self_assessment",
                    task_type=TaskType.SELF_ASSESSMENT,
                    title="Create Self-Assessment Tools",
                    description="Create self-assessment rubrics and checklists",
                    dependencies=["content_hands_on"]
                )
        
        # === SUMMARY SECTION ===
        summary_deps = ["content_exercises"] if depth_level == "basic" else ["content_applied_problems"]
        if depth_level in ["comprehensive", "expert"]:
            summary_deps = ["content_hands_on"]
        if depth_level == "expert":
            summary_deps = ["content_self_assessment"]
        
        if depth_level == "basic":
            self.tasks["content_summary"] = LessonTask(
                task_id="content_summary",
                task_type=TaskType.KEY_TAKEAWAYS,
                title="Generate Summary",
                description="Generate lesson summary",
                dependencies=summary_deps
            )
        else:
            self.tasks["content_takeaways"] = LessonTask(
                task_id="content_takeaways",
                task_type=TaskType.KEY_TAKEAWAYS,
                title="Summarize Key Takeaways",
                description="Distill the essential lessons learned",
                dependencies=summary_deps
            )
            
            self.tasks["content_reflection"] = LessonTask(
                task_id="content_reflection",
                task_type=TaskType.REFLECTION_QUESTIONS,
                title="Add Reflection Questions",
                description="Create questions for deeper reflection",
                dependencies=["content_takeaways"]
            )
            
            if depth_level in ["comprehensive", "expert"]:
                self.tasks["content_next_steps"] = LessonTask(
                    task_id="content_next_steps",
                    task_type=TaskType.NEXT_STEPS,
                    title="Outline Next Steps",
                    description="Guide learners on what to do next",
                    dependencies=["content_reflection"]
                )
                
                self.tasks["content_resources"] = LessonTask(
                    task_id="content_resources",
                    task_type=TaskType.ADDITIONAL_RESOURCES,
                    title="Compile Additional Resources",
                    description="Provide curated resources for further learning",
                    dependencies=["content_next_steps"]
                )
    
    def _add_enhancement_tasks(self, depth_level: str):
        """Add enhancement phase tasks"""
        # Get last content task
        if depth_level == "comprehensive":
            last_content = "content_resources"
        else:  # expert
            last_content = "content_resources"
        
        self.tasks["enhance_analogies"] = LessonTask(
            task_id="enhance_analogies",
            task_type=TaskType.ANALOGY_GENERATION,
            title="Add Analogies & Metaphors",
            description="Create powerful analogies and metaphors for complex concepts",
            dependencies=[last_content]
        )
        
        self.tasks["enhance_visuals"] = LessonTask(
            task_id="enhance_visuals",
            task_type=TaskType.VISUAL_DESCRIPTIONS,
            title="Add Visual Descriptions",
            description="Add descriptions for diagrams, charts, and visual aids",
            dependencies=["enhance_analogies"]
        )
        
        if depth_level == "expert":
            self.tasks["enhance_examples"] = LessonTask(
                task_id="enhance_examples",
                task_type=TaskType.EXAMPLE_ENRICHMENT,
                title="Enrich Examples",
                description="Add more depth and variety to examples",
                dependencies=["enhance_visuals"]
            )
            
            self.tasks["enhance_bridges"] = LessonTask(
                task_id="enhance_bridges",
                task_type=TaskType.CONCEPT_BRIDGES,
                title="Build Concept Bridges",
                description="Add explicit connections between concepts and prior knowledge",
                dependencies=["enhance_examples"]
            )
    
    def _add_validation_tasks(self, depth_level: str):
        """Add validation phase tasks"""
        # Get last task from previous phase
        if depth_level == "standard":
            last_task = "content_reflection"
        elif depth_level == "comprehensive":
            last_task = "enhance_visuals"
        else:  # expert
            last_task = "enhance_bridges"
        
        self.tasks["validate_review"] = LessonTask(
            task_id="validate_review",
            task_type=TaskType.CONTENT_REVIEW,
            title="Review Content Coherence",
            description="Review overall content flow and coherence",
            dependencies=[last_task]
        )
        
        self.tasks["validate_quality"] = LessonTask(
            task_id="validate_quality",
            task_type=TaskType.QUALITY_ASSURANCE,
            title="Quality Assurance Check",
            description="Final quality check and refinement suggestions",
            dependencies=["validate_review"]
        )
    
    def _check_dependencies(self, task: LessonTask) -> bool:
        """Check if all task dependencies are completed"""
        for dep_id in task.dependencies:
            if dep_id not in self.tasks:
                continue
            dep_task = self.tasks[dep_id]
            if dep_task.status not in [TaskStatus.COMPLETED, TaskStatus.SKIPPED]:
                return False
        return True
    
    def _execute_task(self, task: LessonTask) -> Optional[str]:
        """Execute a single task and return the result"""
        # Build context from previous task results
        context = self._build_task_context(task)
        
        # Generate prompt based on task type
        prompt = self._build_task_prompt(task, context)
        
        # Determine optimal token limit for task type
        max_tokens = self._get_task_token_limit(task.task_type)
        
        # Make AI request
        result, provider = self.provider.make_ai_request(
            prompt,
            temperature=0.7,
            max_tokens=max_tokens
        )
        
        if result:
            # Parse JSON if expected
            if task.task_type in [
                TaskType.TOPIC_ANALYSIS, TaskType.CONCEPT_MAPPING,
                TaskType.LESSON_OUTLINE, TaskType.LEARNING_OBJECTIVES,
                TaskType.SECTION_PLANNING, TaskType.ASSESSMENT_PLANNING,
                TaskType.PREREQUISITE_ANALYSIS, TaskType.LEARNING_PATH_DESIGN
            ]:
                parsed = json_parser.parse_json_response(result, task.title)
                if parsed:
                    return json.dumps(parsed)
            return result
        
        return None
    
    def _build_task_context(self, task: LessonTask) -> Dict[str, Any]:
        """Build context from previous task results for the current task"""
        context = {
            **self.generation_context,
            "previous_results": {}
        }
        
        # Include results from dependencies
        for dep_id in task.dependencies:
            if dep_id in self.task_results:
                result = self.task_results[dep_id]
                try:
                    context["previous_results"][dep_id] = json.loads(result)
                except (json.JSONDecodeError, TypeError):
                    context["previous_results"][dep_id] = result
        
        return context
    
    def _get_task_token_limit(self, task_type: TaskType) -> int:
        """Get optimal token limit for task type"""
        # Research and planning tasks - smaller outputs
        if task_type in [
            TaskType.TOPIC_ANALYSIS, TaskType.CONCEPT_MAPPING,
            TaskType.LESSON_OUTLINE, TaskType.LEARNING_OBJECTIVES,
            TaskType.PREREQUISITE_ANALYSIS, TaskType.LEARNING_PATH_DESIGN,
            TaskType.SECTION_PLANNING, TaskType.ASSESSMENT_PLANNING
        ]:
            return 2048
        
        # Content generation tasks - larger outputs
        if task_type in [
            TaskType.THEORETICAL_FRAMEWORKS, TaskType.WORKED_EXAMPLES,
            TaskType.CODE_EXAMPLES, TaskType.CASE_STUDIES
        ]:
            return 3500
        
        # Default for other content tasks
        return 2500
    
    def _build_task_prompt(self, task: LessonTask, context: Dict[str, Any]) -> str:
        """Build the prompt for a specific task"""
        # Build base context string
        lesson_context = f"""LESSON CONTEXT:
- Course: {context['course_title']}
- Module: {context['module_title']}
- Module Description: {context['module_description']}
- Module Objectives: {context['module_objectives']}
- Lesson Title: {context['lesson_title']}
- Lesson Focus: {context.get('lesson_description', 'Not specified')}
- Difficulty: {context['difficulty_level'].capitalize()}
"""
        
        # Add existing lessons context
        if context.get('existing_lessons'):
            lesson_context += f"\nPREVIOUS LESSONS ({len(context['existing_lessons'])}):\n"
            for idx, lesson in enumerate(context['existing_lessons'][-3:], 1):
                lesson_context += f"  {idx}. {lesson.get('title', 'Untitled')}\n"
        
        # Add previous task results summary
        if context.get('previous_results'):
            lesson_context += "\nPREVIOUS TASK OUTPUTS:\n"
            for task_id, result in list(context['previous_results'].items())[-3:]:
                if isinstance(result, dict):
                    summary = str(result)[:500] + "..." if len(str(result)) > 500 else str(result)
                else:
                    summary = str(result)[:500] + "..." if len(str(result)) > 500 else result
                lesson_context += f"  - {task_id}: {summary}\n"
        
        # Task-specific prompts
        prompts = {
            # Research Phase
            TaskType.TOPIC_ANALYSIS: f"""{lesson_context}

TASK: Deep Topic Analysis
As an expert educator, analyze the lesson topic deeply to understand:
1. Core subject matter and its scope
2. Key subtopics that must be covered
3. Depth of coverage needed at {context['difficulty_level']} level
4. Relationship to broader field/discipline
5. Current relevance and applications

Return ONLY valid JSON:
{{
  "topic_scope": "Description of the topic scope...",
  "core_concepts": ["Concept 1", "Concept 2", "Concept 3"],
  "subtopics": ["Subtopic 1", "Subtopic 2"],
  "depth_analysis": "Analysis of appropriate depth...",
  "field_connections": ["Related field 1", "Related field 2"],
  "current_relevance": "Why this matters today...",
  "estimated_complexity": "beginner|intermediate|advanced"
}}""",

            TaskType.CONCEPT_MAPPING: f"""{lesson_context}

PREVIOUS ANALYSIS:
{json.dumps(context.get('previous_results', {}).get('research_topic', {}), indent=2)}

TASK: Concept Mapping
Create a detailed concept map showing:
1. Primary concepts (3-5 main ideas)
2. Secondary concepts (supporting ideas)
3. Relationships between concepts
4. Prerequisites for each concept
5. Common misconceptions

Return ONLY valid JSON:
{{
  "primary_concepts": [
    {{"name": "Concept", "definition": "Clear definition", "importance": "Why critical"}}
  ],
  "secondary_concepts": [
    {{"name": "Concept", "relates_to": "Primary concept", "role": "Supporting role"}}
  ],
  "concept_relationships": [
    {{"from": "Concept A", "to": "Concept B", "relationship": "leads to|requires|enables"}}
  ],
  "prerequisites": [
    {{"concept": "Concept", "prerequisite": "What learner needs to know"}}
  ],
  "misconceptions": [
    {{"concept": "Concept", "misconception": "Common wrong idea", "correction": "Correct understanding"}}
  ]
}}""",

            TaskType.PREREQUISITE_ANALYSIS: f"""{lesson_context}

TASK: Prerequisite Analysis
Analyze prerequisites for this lesson:
1. Knowledge prerequisites (what learners must know)
2. Skill prerequisites (abilities needed)
3. Tool/resource prerequisites
4. Gap analysis (common missing prerequisites)
5. Prerequisite levels (essential vs. helpful)

Return ONLY valid JSON:
{{
  "knowledge_prerequisites": [
    {{"topic": "Topic", "level": "basic|intermediate|advanced", "essential": true}}
  ],
  "skill_prerequisites": [
    {{"skill": "Skill description", "essential": true}}
  ],
  "tool_prerequisites": ["Tool 1", "Tool 2"],
  "common_gaps": [
    {{"gap": "Common knowledge gap", "how_to_address": "Brief coverage in lesson"}}
  ]
}}""",

            TaskType.LEARNING_PATH_DESIGN: f"""{lesson_context}

TASK: Learning Path Design
Design the optimal learning path:
1. Cognitive load distribution
2. Scaffolding strategy
3. Spaced repetition points
4. Assessment checkpoints
5. Learning milestones

Return ONLY valid JSON:
{{
  "learning_phases": [
    {{"phase": "Phase name", "duration_minutes": 15, "cognitive_load": "low|medium|high", "objective": "What learner achieves"}}
  ],
  "scaffolding_strategy": "Description of how we build understanding...",
  "repetition_points": ["Point 1 where concept is revisited", "Point 2"],
  "checkpoints": [
    {{"after_section": "Section name", "assessment_type": "quick check|quiz|exercise"}}
  ],
  "milestones": ["Milestone 1", "Milestone 2"]
}}""",

            # Planning Phase
            TaskType.LESSON_OUTLINE: f"""{lesson_context}

TASK: Create Detailed Lesson Outline
Design the complete lesson structure:
1. Introduction approach
2. Main content sections (with subsections)
3. Practical components
4. Exercise structure
5. Conclusion approach
6. Time allocation

Return ONLY valid JSON:
{{
  "introduction": {{
    "approach": "How to open the lesson",
    "hook_type": "question|story|statistic|scenario",
    "duration_minutes": 10
  }},
  "main_sections": [
    {{
      "title": "Section Title",
      "objective": "What this section teaches",
      "subsections": ["Subsection 1", "Subsection 2"],
      "duration_minutes": 20,
      "content_type": "theory|practical|mixed"
    }}
  ],
  "practical_components": [
    {{"type": "example|exercise|demo", "description": "What it covers", "duration_minutes": 10}}
  ],
  "conclusion": {{
    "summary_approach": "How to wrap up",
    "duration_minutes": 5
  }},
  "total_duration_minutes": 60
}}""",

            TaskType.LEARNING_OBJECTIVES: f"""{lesson_context}

TASK: Define Learning Objectives
Create specific, measurable learning objectives using Bloom's Taxonomy:

Cognitive Levels:
1. Remember - Recall facts and basic concepts
2. Understand - Explain ideas or concepts
3. Apply - Use information in new situations
4. Analyze - Draw connections among ideas
5. Evaluate - Justify a decision or course of action
6. Create - Produce new or original work

Return ONLY valid JSON:
{{
  "learning_objectives": [
    {{
      "objective": "Students will be able to [VERB] [WHAT] [CONTEXT]",
      "bloom_level": "remember|understand|apply|analyze|evaluate|create",
      "measurable_outcome": "How we verify this was achieved",
      "importance": "primary|secondary"
    }}
  ],
  "skills_developed": ["Skill 1", "Skill 2"],
  "knowledge_gained": ["Knowledge area 1", "Knowledge area 2"]
}}""",

            TaskType.SECTION_PLANNING: f"""{lesson_context}

OUTLINE:
{json.dumps(context.get('previous_results', {}).get('plan_outline', {}), indent=2)}

OBJECTIVES:
{json.dumps(context.get('previous_results', {}).get('plan_objectives', {}), indent=2)}

TASK: Detailed Section Planning
Plan detailed content for each section:

Return ONLY valid JSON:
{{
  "sections": [
    {{
      "section_id": "introduction",
      "title": "Introduction",
      "key_points": ["Point 1", "Point 2", "Point 3"],
      "examples_needed": ["Example type 1"],
      "visuals_needed": ["Diagram of...", "Chart showing..."],
      "engagement_techniques": ["Technique 1"],
      "transition_to_next": "How this leads to next section"
    }}
  ]
}}""",

            TaskType.ASSESSMENT_PLANNING: f"""{lesson_context}

OBJECTIVES:
{json.dumps(context.get('previous_results', {}).get('plan_objectives', {}), indent=2)}

TASK: Assessment Strategy Planning
Plan comprehensive assessment approach:

Return ONLY valid JSON:
{{
  "formative_assessments": [
    {{"type": "Type", "placement": "After which section", "purpose": "What it checks"}}
  ],
  "summative_assessments": [
    {{"type": "Type", "covers": "What content", "format": "Format description"}}
  ],
  "self_assessment_tools": ["Tool 1", "Tool 2"],
  "rubric_criteria": [
    {{"criterion": "What is assessed", "levels": ["Beginning", "Developing", "Proficient", "Expert"]}}
  ]
}}""",

            # Introduction Content Tasks
            TaskType.HOOK_GENERATION: f"""{lesson_context}

TASK: Generate Engaging Hook
Create a compelling opening that immediately captures attention:
- Use a thought-provoking question, surprising fact, relevant story, or compelling scenario
- Connect to learner's existing experience or curiosity
- Build anticipation for what they'll learn
- Keep it concise but impactful (150-250 words)

Write in Markdown format. Make it memorable and engaging.
Start directly with the hook content, no preamble.""",

            TaskType.CONTEXT_SETTING: f"""{lesson_context}

HOOK:
{context.get('previous_results', {}).get('content_hook', 'Not yet generated')}

TASK: Set Learning Context
Establish why this topic matters and where it fits:
- Connect to real-world applications
- Show relevance to learner's goals
- Place topic in broader context of the field
- Reference prior knowledge and upcoming lessons
- Build motivation for deep engagement (200-300 words)

Write in Markdown format. Use clear, engaging language.""",

            TaskType.MOTIVATION_SECTION: f"""{lesson_context}

CONTEXT:
{context.get('previous_results', {}).get('content_context', 'Not yet generated')}

TASK: Create Motivation Section
Explain why this topic is worth mastering:
- Career benefits and opportunities
- Problem-solving capabilities gained
- Real-world impact and applications
- Stories of successful application
- Connection to personal growth (250-350 words)

Write in Markdown format. Be inspiring but authentic.""",

            TaskType.OVERVIEW_SECTION: f"""{lesson_context}

TASK: Write Lesson Overview
Provide a roadmap of the lesson:
- What will be covered and in what order
- Learning objectives in accessible language
- What learners will be able to do after
- Estimated time for each section
- How to get the most from the lesson (200-300 words)

Write in Markdown format. Use clear structure.""",

            # Theory Content Tasks
            TaskType.DEFINITIONS_CORE: f"""{lesson_context}

TASK: Write Core Definitions
Define key terms and concepts with precision:
- Clear, concise definitions
- Multiple perspectives where relevant
- Examples that illuminate meaning
- Common usage in the field
- Relationships between terms (400-600 words)

Write in Markdown format. Use **bold** for key terms.
Format definitions clearly with proper structure.""",

            TaskType.PRINCIPLES_FUNDAMENTALS: f"""{lesson_context}

DEFINITIONS:
{context.get('previous_results', {}).get('content_definitions', 'See definitions above')}

TASK: Explain Fundamental Principles
Explain the core principles and rules:
- Underlying principles that govern the topic
- Why these principles work (the logic behind them)
- How principles relate to each other
- When and how to apply each principle
- Exceptions and edge cases (500-700 words)

Write in Markdown format with clear headers for each principle.""",

            TaskType.THEORETICAL_FRAMEWORKS: f"""{lesson_context}

TASK: Present Theoretical Frameworks
Present academic frameworks and models:
- Major theoretical perspectives
- Key models and their components
- How frameworks help understanding
- Comparing different frameworks
- Practical implications of each (500-700 words)

Write in Markdown format. Include diagrams described in text if helpful.""",

            TaskType.CONCEPT_CONNECTIONS: f"""{lesson_context}

TASK: Show Concept Connections
Demonstrate how concepts interconnect:
- Relationships between ideas covered
- Connections to prior knowledge
- Links to other fields/disciplines
- Building blocks for advanced concepts
- Mental models for organizing knowledge (400-500 words)

Write in Markdown format. Consider using bullet points for clarity.""",

            TaskType.HISTORICAL_CONTEXT: f"""{lesson_context}

TASK: Provide Historical Context
Trace the development of these ideas:
- Origin and early development
- Key figures and contributions
- Evolution of understanding
- Major paradigm shifts
- Current state and trends (400-500 words)

Write in Markdown format. Make history engaging and relevant.""",

            TaskType.ADVANCED_CONSIDERATIONS: f"""{lesson_context}

TASK: Discuss Advanced Considerations
Cover sophisticated aspects:
- Edge cases and exceptions
- Current debates in the field
- Limitations of current understanding
- Emerging developments
- Areas of ongoing research (400-500 words)

Write in Markdown format. Be nuanced but accessible.""",

            # Practical Content Tasks
            TaskType.USE_CASES_REAL_WORLD: f"""{lesson_context}

TASK: Present Real-World Use Cases
Show practical applications:
- 3-4 compelling real-world examples
- Industry applications
- How professionals use these concepts
- Impact on real problems/products
- Diversity of applications (500-700 words)

Write in Markdown format. Use specific, concrete examples.""",

            TaskType.WORKED_EXAMPLES: f"""{lesson_context}

TASK: Create Worked Examples
Provide detailed worked examples:
- 2-3 complete worked examples
- Step-by-step breakdown
- Explanation of reasoning at each step
- Common decision points highlighted
- Variations and alternatives shown (600-800 words)

Write in Markdown format. Number steps clearly.""",

            TaskType.CODE_EXAMPLES: f"""{lesson_context}

TASK: Write Code Examples
Create illustrative code examples:
- Well-commented, clean code
- Multiple examples showing different aspects
- Error handling and edge cases
- Best practices demonstrated
- Common patterns illustrated

Write in Markdown format with properly formatted code blocks.
Include comments explaining key lines. (500-700 words including code)""",

            TaskType.BEST_PRACTICES: f"""{lesson_context}

TASK: Document Best Practices
Compile industry best practices:
- 5-7 key best practices
- Why each practice matters
- How to implement each
- Common violations and consequences
- Checklist for following practices (400-500 words)

Write in Markdown format with clear structure.""",

            TaskType.COMMON_PITFALLS: f"""{lesson_context}

TASK: Warn About Common Pitfalls
Highlight mistakes to avoid:
- 4-6 common mistakes/pitfalls
- Why these mistakes happen
- Warning signs to watch for
- How to recover from each
- Prevention strategies (400-500 words)

Write in Markdown format. Be specific and helpful.""",

            TaskType.CASE_STUDIES: f"""{lesson_context}

TASK: Present Case Studies
Develop detailed case studies:
- 1-2 in-depth case studies
- Real or realistic scenarios
- Context and background
- Challenge/problem presented
- Solution approach and reasoning
- Outcomes and lessons learned (700-900 words)

Write in Markdown format. Make them engaging narratives.""",

            # Exercise Tasks
            TaskType.CONCEPT_CHECK_QUESTIONS: f"""{lesson_context}

TASK: Create Concept Check Questions
Design questions that verify understanding:
- 5-7 questions covering key concepts
- Mix of question types (multiple choice, short answer, true/false)
- Clear, unambiguous wording
- Answers with explanations
- Progressive difficulty (400-500 words)

Write in Markdown format. Include answer key.""",

            TaskType.APPLIED_PROBLEMS: f"""{lesson_context}

TASK: Design Applied Problems
Create problems requiring application:
- 3-4 applied problems
- Real-world contexts
- Clear problem statements
- Guidance without giving away answers
- Solution approaches (not full solutions) (400-500 words)

Write in Markdown format. Make problems engaging.""",

            TaskType.CRITICAL_THINKING: f"""{lesson_context}

TASK: Create Critical Thinking Challenges
Design challenges requiring deeper thinking:
- 2-3 analysis/evaluation scenarios
- Open-ended questions
- Multiple valid approaches
- Debate/discussion topics
- Reflection prompts (350-450 words)

Write in Markdown format. Encourage deep thinking.""",

            TaskType.HANDS_ON_ACTIVITIES: f"""{lesson_context}

TASK: Create Hands-On Activities
Design practical activities:
- 2-3 hands-on exercises
- Clear instructions
- Required materials/tools
- Expected outcomes
- Time estimates
- Variations for different levels (400-500 words)

Write in Markdown format. Make activities engaging.""",

            TaskType.SELF_ASSESSMENT: f"""{lesson_context}

TASK: Create Self-Assessment Tools
Develop self-assessment resources:
- Skills checklist (I can do X, Y, Z)
- Understanding rubric
- Confidence assessment
- Gaps identification guide
- Next steps based on assessment (350-450 words)

Write in Markdown format. Include checkboxes where appropriate.""",

            # Summary Tasks
            TaskType.KEY_TAKEAWAYS: f"""{lesson_context}

TASK: Summarize Key Takeaways
Distill the essential lessons:
- 5-7 most important takeaways
- Concise but complete summaries
- Memorable formulations
- Priority ordering
- Action implications (300-400 words)

Write in Markdown format. Make takeaways memorable.""",

            TaskType.REFLECTION_QUESTIONS: f"""{lesson_context}

TASK: Create Reflection Questions
Prompt deeper reflection:
- 4-6 reflection questions
- Personal connection questions
- Application planning questions
- Growth mindset prompts
- Discussion starters (250-350 words)

Write in Markdown format. Be thought-provoking.""",

            TaskType.NEXT_STEPS: f"""{lesson_context}

TASK: Outline Next Steps
Guide continued learning:
- Immediate practice suggestions
- Short-term learning goals
- Long-term mastery path
- Related topics to explore
- Projects to attempt (300-400 words)

Write in Markdown format. Be actionable and inspiring.""",

            TaskType.ADDITIONAL_RESOURCES: f"""{lesson_context}

TASK: Compile Additional Resources
Provide curated resources:
- Recommended readings (books, articles)
- Video resources
- Interactive tools/websites
- Communities and forums
- Practice platforms
- Brief description of each resource (350-450 words)

Write in Markdown format. Organize by type.""",

            # Enhancement Tasks
            TaskType.ANALOGY_GENERATION: f"""{lesson_context}

TASK: Create Powerful Analogies
Develop analogies for complex concepts:
- 3-5 analogies for key concepts
- Familiar source domains
- Clear mapping to target concepts
- Limitations of each analogy
- When to use each (300-400 words)

Write in Markdown format. Make analogies memorable.""",

            TaskType.VISUAL_DESCRIPTIONS: f"""{lesson_context}

TASK: Describe Visual Aids
Describe useful visual aids:
- 2-3 diagrams/charts needed
- Detailed description of what each shows
- Key elements to include
- How to read/interpret
- What it helps understand (300-400 words)

Write in Markdown format. Be specific enough to create from description.""",

            TaskType.EXAMPLE_ENRICHMENT: f"""{lesson_context}

TASK: Enrich Examples
Add depth to existing examples:
- Alternative perspectives on examples
- Edge cases and variations
- Counter-examples
- Cross-domain applications
- Extended scenarios (400-500 words)

Write in Markdown format. Add genuine insight.""",

            TaskType.CONCEPT_BRIDGES: f"""{lesson_context}

TASK: Build Concept Bridges
Connect concepts explicitly:
- Links to prior course content
- Connections to other fields
- Applications across domains
- Transferable insights
- Integration points (300-400 words)

Write in Markdown format. Make connections explicit.""",

            # Validation Tasks
            TaskType.CONTENT_REVIEW: f"""{lesson_context}

TASK: Review Content Coherence
Review the lesson for:
- Logical flow and progression
- Completeness of coverage
- Consistency in terminology
- Appropriate difficulty level
- Engagement throughout

Provide a brief review summary and any suggestions for improvement.
Format as a structured review in Markdown (250-350 words).""",

            TaskType.QUALITY_ASSURANCE: f"""{lesson_context}

TASK: Quality Assurance Check
Final quality check covering:
- Accuracy of content
- Clarity of explanations
- Adequacy of examples
- Exercise effectiveness
- Overall learning value

Provide quality score (1-100) and specific improvement suggestions.
Format as structured QA report in Markdown (300-400 words).""",
        }
        
        return prompts.get(task.task_type, f"Generate content for: {task.title}")
    
    def _assemble_lesson_from_tasks(self) -> Dict[str, Any]:
        """Assemble the final lesson from all task results"""
        # Get metadata from planning tasks
        outline = {}
        objectives = {}
        
        if "plan_outline" in self.task_results:
            try:
                outline = json.loads(self.task_results["plan_outline"])
            except (json.JSONDecodeError, TypeError):
                pass
        
        if "plan_objectives" in self.task_results:
            try:
                objectives = json.loads(self.task_results["plan_objectives"])
            except (json.JSONDecodeError, TypeError):
                pass
        
        # Build content sections
        content_sections = OrderedDict()
        
        # Introduction
        intro_content = self._assemble_section("introduction", [
            "content_introduction", "content_hook", "content_context",
            "content_motivation", "content_overview"
        ])
        if intro_content:
            content_sections["introduction"] = intro_content
        
        # Theory
        theory_content = self._assemble_section("theory", [
            "content_theory", "content_definitions", "content_principles",
            "content_frameworks", "content_connections", "content_history",
            "content_advanced"
        ])
        if theory_content:
            content_sections["theoretical_foundation"] = theory_content
        
        # Practical
        practical_content = self._assemble_section("practical", [
            "content_practical", "content_use_cases", "content_worked_examples",
            "content_code", "content_best_practices", "content_pitfalls",
            "content_case_studies"
        ])
        if practical_content:
            content_sections["practical_applications"] = practical_content
        
        # Exercises
        exercise_content = self._assemble_section("exercises", [
            "content_exercises", "content_concept_checks", "content_applied_problems",
            "content_critical_thinking", "content_hands_on", "content_self_assessment"
        ])
        if exercise_content:
            content_sections["exercises"] = exercise_content
        
        # Summary
        summary_content = self._assemble_section("summary", [
            "content_summary", "content_takeaways", "content_reflection",
            "content_next_steps", "content_resources"
        ])
        if summary_content:
            content_sections["summary"] = summary_content
        
        # Enhancement content (insert into relevant sections)
        if "enhance_analogies" in self.task_results:
            if "theoretical_foundation" in content_sections:
                content_sections["theoretical_foundation"] += f"\n\n### Helpful Analogies\n\n{self.task_results['enhance_analogies']}"
        
        if "enhance_visuals" in self.task_results:
            if "theoretical_foundation" in content_sections:
                content_sections["theoretical_foundation"] += f"\n\n### Visual Aids\n\n{self.task_results['enhance_visuals']}"
        
        # Build complete lesson document
        lesson_title = self.generation_context.get("lesson_title", "Lesson")
        description = self.generation_context.get("lesson_description", "")
        difficulty = self.generation_context.get("difficulty_level", "intermediate")
        
        # Get learning objectives
        learning_obj_list = objectives.get("learning_objectives", [])
        if isinstance(learning_obj_list, list):
            learning_objectives = "\n".join(
                f"• {obj.get('objective', obj) if isinstance(obj, dict) else obj}"
                for obj in learning_obj_list
            )
        else:
            learning_objectives = "• Complete this lesson successfully"
        
        # Get duration
        duration = outline.get("total_duration_minutes", 60)
        if isinstance(duration, dict):
            duration = 60
        
        # Assemble complete content
        complete_content = self._build_complete_document(
            lesson_title, description, difficulty, duration,
            learning_objectives, content_sections
        )
        
        return {
            "title": lesson_title,
            "description": description,
            "learning_objectives": learning_objectives,
            "duration_minutes": duration,
            "difficulty_level": difficulty,
            "content_type": "text",
            "content_data": complete_content,
            "sections": content_sections,
            "metadata": {
                "outline": outline,
                "objectives": objectives,
                "depth_level": self.generation_context.get("depth_level", "standard"),
                "generation_method": "task-based"
            }
        }
    
    def _assemble_section(self, section_name: str, task_ids: List[str]) -> str:
        """Assemble a section from multiple task results"""
        content_parts = []
        
        for task_id in task_ids:
            if task_id in self.task_results:
                result = self.task_results[task_id]
                if result and not result.startswith("{"):  # Skip JSON results
                    content_parts.append(result.strip())
        
        if content_parts:
            return "\n\n".join(content_parts)
        return ""
    
    def _build_complete_document(
        self,
        title: str,
        description: str,
        difficulty: str,
        duration: int,
        learning_objectives: str,
        sections: Dict[str, str]
    ) -> str:
        """Build the complete lesson document"""
        doc = f"""# {title}

{description}

---

## 📋 Lesson Overview

**Duration**: {duration} minutes  
**Difficulty Level**: {difficulty.capitalize()}  
**Last Updated**: {datetime.now().strftime('%B %d, %Y')}

### Learning Objectives

{learning_objectives}

---

"""
        
        section_titles = {
            "introduction": "## 🎯 Introduction",
            "theoretical_foundation": "## 📚 Theoretical Foundation",
            "practical_applications": "## 💡 Practical Applications",
            "exercises": "## ✏️ Exercises & Practice",
            "summary": "## 📝 Summary & Next Steps"
        }
        
        for section_key, section_title in section_titles.items():
            if section_key in sections and sections[section_key]:
                doc += f"\n{section_title}\n\n{sections[section_key]}\n\n---\n"
        
        doc += """
## 🎓 Lesson Complete!

Congratulations on completing this comprehensive lesson!

### What's Next
1. ✅ Review the key takeaways
2. 📝 Complete all practice exercises
3. 🔍 Explore the additional resources
4. 💬 Participate in discussions
5. 🚀 Apply these concepts in your projects

---

*Remember: Mastery comes through practice and application. Keep pushing forward!* 🌟
"""
        
        return doc
    
    def _generate_report(self, start_time: float) -> Dict[str, Any]:
        """Generate the task execution report"""
        total_time = time.time() - start_time
        
        completed = sum(1 for t in self.tasks.values() if t.status == TaskStatus.COMPLETED)
        failed = sum(1 for t in self.tasks.values() if t.status == TaskStatus.FAILED)
        skipped = sum(1 for t in self.tasks.values() if t.status == TaskStatus.SKIPPED)
        
        task_times = [t.execution_time for t in self.tasks.values() if t.execution_time > 0]
        avg_task_time = sum(task_times) / len(task_times) if task_times else 0
        
        return {
            "total_tasks": len(self.tasks),
            "completed_tasks": completed,
            "failed_tasks": failed,
            "skipped_tasks": skipped,
            "success_rate": (completed / len(self.tasks)) * 100 if self.tasks else 0,
            "total_generation_time": round(total_time, 2),
            "average_task_time": round(avg_task_time, 2),
            "depth_level": self.generation_context.get("depth_level", "standard"),
            "tasks_by_status": {
                "completed": [t.task_id for t in self.tasks.values() if t.status == TaskStatus.COMPLETED],
                "failed": [t.task_id for t in self.tasks.values() if t.status == TaskStatus.FAILED],
                "skipped": [t.task_id for t in self.tasks.values() if t.status == TaskStatus.SKIPPED]
            }
        }


# Singleton instance
task_based_lesson_generator = TaskBasedLessonGenerator()
