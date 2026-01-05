"""
Chapter-Based Lesson Generation Module

This module generates comprehensive lessons using a chapter-by-chapter approach:
1. First outlines the lesson chapters dynamically based on the topic
2. Works on each chapter as a separate task
3. Goes deep into each chapter with sub-sections
4. Generates content incrementally (not all at once)

Key Features:
- Dynamic chapter outlining based on topic analysis
- Each chapter is a separate task with deep content
- Sub-sections generated per chapter
- Progressive content building
- Real-time progress with chapter-level granularity
"""

import time
import json
import uuid
import logging
import threading
from typing import Dict, List, Optional, Any, Callable, Generator
from datetime import datetime
from enum import Enum
from dataclasses import dataclass, field
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor, as_completed

from .ai_providers import ai_provider_manager
from .json_parser import json_parser
from .content_validator import ContentValidator
from .fallback_generators import fallback_generators

logger = logging.getLogger(__name__)


class ChapterTaskType(Enum):
    """Types of chapter-based generation tasks"""
    # Pre-Chapter Tasks
    LESSON_ANALYSIS = "lesson_analysis"
    CHAPTER_OUTLINE = "chapter_outline"
    
    # Per-Chapter Tasks
    CHAPTER_INTRODUCTION = "chapter_introduction"
    CHAPTER_THEORY = "chapter_theory"
    CHAPTER_EXAMPLES = "chapter_examples"
    CHAPTER_EXERCISES = "chapter_exercises"
    CHAPTER_SUMMARY = "chapter_summary"
    
    # Post-Chapter Tasks
    LESSON_SUMMARY = "lesson_summary"
    ASSESSMENT_GENERATION = "assessment_generation"


class ChapterStatus(Enum):
    """Chapter generation status"""
    PENDING = "pending"
    OUTLINING = "outlining"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class ChapterOutline:
    """Represents a chapter outline"""
    chapter_id: str
    chapter_number: int
    title: str
    description: str
    key_topics: List[str] = field(default_factory=list)
    learning_objectives: List[str] = field(default_factory=list)
    estimated_sections: int = 3
    status: ChapterStatus = ChapterStatus.PENDING
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "chapter_id": self.chapter_id,
            "chapter_number": self.chapter_number,
            "title": self.title,
            "description": self.description,
            "key_topics": self.key_topics,
            "learning_objectives": self.learning_objectives,
            "estimated_sections": self.estimated_sections,
            "status": self.status.value
        }


@dataclass
class ChapterContent:
    """Represents generated content for a chapter"""
    chapter_id: str
    title: str
    introduction: str = ""
    theory_content: str = ""
    examples: List[Dict[str, Any]] = field(default_factory=list)
    exercises: List[Dict[str, Any]] = field(default_factory=list)
    summary: str = ""
    key_takeaways: List[str] = field(default_factory=list)
    subsections: List[Dict[str, Any]] = field(default_factory=list)
    execution_time: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "chapter_id": self.chapter_id,
            "title": self.title,
            "introduction": self.introduction,
            "theory_content": self.theory_content,
            "examples": self.examples,
            "exercises": self.exercises,
            "summary": self.summary,
            "key_takeaways": self.key_takeaways,
            "subsections": self.subsections,
            "execution_time": self.execution_time
        }


class ChapterSession:
    """
    Manages a chapter-based lesson generation session.
    
    Tracks:
    - Lesson context
    - Chapter outlines
    - Generated chapter content
    - Progress per chapter
    """
    
    def __init__(self, session_id: Optional[str] = None):
        self.session_id = session_id or str(uuid.uuid4())
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
        self.status = "initialized"
        
        # Lesson context
        self.context: Dict[str, Any] = {}
        
        # Chapter data
        self.chapter_outlines: List[ChapterOutline] = []
        self.chapter_contents: Dict[str, ChapterContent] = {}
        
        # Progress tracking
        self.progress = {
            "phase": "initialized",  # outlining, generating, completed
            "total_chapters": 0,
            "completed_chapters": 0,
            "current_chapter": None,
            "current_chapter_phase": None,
            "percentage": 0
        }
        
        # Timing
        self.timing = {
            "start_time": 0,
            "outline_time": 0,
            "generation_time": 0,
            "total_time": 0
        }
        
        # Generated lesson data
        self.lesson_data = {
            "title": "",
            "description": "",
            "learning_objectives": [],
            "introduction": "",
            "chapters": [],
            "conclusion": "",
            "assessment": {}
        }
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "status": self.status,
            "context": self.context,
            "chapter_outlines": [c.to_dict() for c in self.chapter_outlines],
            "chapter_contents": {k: v.to_dict() for k, v in self.chapter_contents.items()},
            "progress": self.progress,
            "timing": self.timing,
            "lesson_data": self.lesson_data
        }
    
    def get_pending_chapters(self) -> List[ChapterOutline]:
        """Get chapters that haven't been generated yet"""
        return [
            outline for outline in self.chapter_outlines
            if outline.status == ChapterStatus.PENDING
        ]
    
    def get_current_chapter(self) -> Optional[ChapterOutline]:
        """Get the chapter currently being generated"""
        for outline in self.chapter_outlines:
            if outline.status == ChapterStatus.IN_PROGRESS:
                return outline
        return None


class ChapterSessionCache:
    """In-memory cache for chapter-based sessions"""
    
    def __init__(self, max_sessions: int = 100, ttl_hours: int = 24):
        self._cache: Dict[str, ChapterSession] = {}
        self._lock = threading.Lock()
        self.max_sessions = max_sessions
        self.ttl_hours = ttl_hours
    
    def create_session(self, context: Dict[str, Any]) -> ChapterSession:
        session = ChapterSession()
        session.context = context
        session.status = "created"
        
        with self._lock:
            if len(self._cache) >= self.max_sessions:
                self._cleanup_old()
            self._cache[session.session_id] = session
        
        return session
    
    def get_session(self, session_id: str) -> Optional[ChapterSession]:
        with self._lock:
            return self._cache.get(session_id)
    
    def update_session(self, session: ChapterSession):
        session.updated_at = datetime.now()
        with self._lock:
            self._cache[session.session_id] = session
    
    def _cleanup_old(self):
        now = datetime.now()
        expired = [
            sid for sid, s in self._cache.items()
            if (now - s.updated_at).total_seconds() > self.ttl_hours * 3600
        ]
        for sid in expired:
            del self._cache[sid]


# Global cache
chapter_session_cache = ChapterSessionCache()


class ChapterBasedLessonGenerator:
    """
    Generates comprehensive lessons using a chapter-by-chapter approach.
    
    Workflow:
    1. Analyze the lesson topic
    2. Generate dynamic chapter outline
    3. For each chapter (as a separate task):
       a. Generate chapter introduction
       b. Generate deep theory content with subsections
       c. Generate examples for the chapter
       d. Generate chapter exercises
       e. Generate chapter summary
    4. Generate lesson conclusion and assessment
    
    Each chapter is a discrete unit - content is built progressively.
    """
    
    def __init__(self, provider_manager=None):
        self.provider = provider_manager or ai_provider_manager
        self.validator = ContentValidator()
        self._progress_callback: Optional[Callable] = None
        self._current_session: Optional[ChapterSession] = None
    
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
        target_chapters: int = 5,
        chapter_depth: str = "deep"  # shallow, standard, deep
    ) -> str:
        """
        Create a new chapter-based generation session.
        
        Args:
            target_chapters: Target number of chapters (AI may adjust based on topic)
            chapter_depth: How deep to go in each chapter
        
        Returns:
            Session ID
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
            "target_chapters": target_chapters,
            "chapter_depth": chapter_depth
        }
        
        session = chapter_session_cache.create_session(context)
        session.lesson_data["title"] = lesson_title
        session.lesson_data["description"] = lesson_description
        chapter_session_cache.update_session(session)
        
        logger.info(f"Created chapter session {session.session_id} for: {lesson_title}")
        return session.session_id
    
    def get_session_status(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed session status"""
        session = chapter_session_cache.get_session(session_id)
        if not session:
            return None
        
        return {
            "session_id": session.session_id,
            "status": session.status,
            "lesson_title": session.context.get("lesson_title"),
            "progress": session.progress,
            "timing": session.timing,
            "chapters": [
                {
                    "chapter_id": c.chapter_id,
                    "number": c.chapter_number,
                    "title": c.title,
                    "status": c.status.value,
                    "has_content": c.chapter_id in session.chapter_contents
                }
                for c in session.chapter_outlines
            ]
        }
    
    def outline_chapters(
        self,
        session_id: str,
        progress_callback: Optional[Callable] = None
    ) -> List[ChapterOutline]:
        """
        Generate the chapter outline for a lesson.
        This is the first step - determines the structure of the lesson.
        
        Returns:
            List of ChapterOutline objects
        """
        session = chapter_session_cache.get_session(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")
        
        self._current_session = session
        self._progress_callback = progress_callback
        
        session.status = "outlining"
        session.progress["phase"] = "outlining"
        session.timing["start_time"] = time.time()
        chapter_session_cache.update_session(session)
        
        if progress_callback:
            progress_callback(0, 100, "outlining", "Analyzing lesson topic...")
        
        # Step 1: Analyze the topic
        topic_analysis = self._analyze_topic(session)
        
        if progress_callback:
            progress_callback(20, 100, "outlining", "Designing chapter structure...")
        
        # Step 2: Generate chapter outline
        outline_result = self._generate_chapter_outline(session, topic_analysis)
        
        # Parse and create chapter outlines
        chapters = self._parse_chapter_outline(outline_result, session)
        session.chapter_outlines = chapters
        session.progress["total_chapters"] = len(chapters)
        
        session.timing["outline_time"] = time.time() - session.timing["start_time"]
        session.status = "outlined"
        session.progress["phase"] = "ready_to_generate"
        chapter_session_cache.update_session(session)
        
        if progress_callback:
            progress_callback(100, 100, "outlined", f"Outlined {len(chapters)} chapters")
        
        logger.info(f"Session {session_id}: Outlined {len(chapters)} chapters")
        return chapters
    
    def generate_chapter(
        self,
        session_id: str,
        chapter_id: str,
        progress_callback: Optional[Callable] = None
    ) -> ChapterContent:
        """
        Generate content for a single chapter.
        This is called per chapter - not all at once.
        
        Args:
            session_id: The session ID
            chapter_id: The specific chapter to generate
            progress_callback: Callback for progress updates
        
        Returns:
            ChapterContent with all generated content for this chapter
        """
        session = chapter_session_cache.get_session(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")
        
        # Find the chapter
        chapter = None
        for outline in session.chapter_outlines:
            if outline.chapter_id == chapter_id:
                chapter = outline
                break
        
        if not chapter:
            raise ValueError(f"Chapter not found: {chapter_id}")
        
        self._current_session = session
        self._progress_callback = progress_callback
        
        # Mark chapter as in progress
        chapter.status = ChapterStatus.IN_PROGRESS
        session.progress["current_chapter"] = chapter_id
        session.status = "generating"
        session.progress["phase"] = "generating"
        chapter_session_cache.update_session(session)
        
        logger.info(f"Generating chapter {chapter.chapter_number}: {chapter.title}")
        
        chapter_start = time.time()
        
        # Create content object
        content = ChapterContent(
            chapter_id=chapter_id,
            title=chapter.title
        )
        
        try:
            # Phase 1: Generate chapter introduction
            if progress_callback:
                progress_callback(0, 100, "generating", f"Chapter {chapter.chapter_number}: Writing introduction...")
            
            session.progress["current_chapter_phase"] = "introduction"
            content.introduction = self._generate_chapter_introduction(session, chapter)
            
            # Phase 2: Generate theory content with subsections
            if progress_callback:
                progress_callback(20, 100, "generating", f"Chapter {chapter.chapter_number}: Developing theory...")
            
            session.progress["current_chapter_phase"] = "theory"
            theory_result = self._generate_chapter_theory(session, chapter)
            content.theory_content = theory_result.get("content", "")
            content.subsections = theory_result.get("subsections", [])
            
            # Phase 3: Generate examples
            if progress_callback:
                progress_callback(50, 100, "generating", f"Chapter {chapter.chapter_number}: Creating examples...")
            
            session.progress["current_chapter_phase"] = "examples"
            content.examples = self._generate_chapter_examples(session, chapter, content)
            
            # Phase 4: Generate exercises
            if progress_callback:
                progress_callback(70, 100, "generating", f"Chapter {chapter.chapter_number}: Designing exercises...")
            
            session.progress["current_chapter_phase"] = "exercises"
            content.exercises = self._generate_chapter_exercises(session, chapter, content)
            
            # Phase 5: Generate summary
            if progress_callback:
                progress_callback(90, 100, "generating", f"Chapter {chapter.chapter_number}: Writing summary...")
            
            session.progress["current_chapter_phase"] = "summary"
            summary_result = self._generate_chapter_summary(session, chapter, content)
            content.summary = summary_result.get("summary", "")
            content.key_takeaways = summary_result.get("key_takeaways", [])
            
            content.execution_time = time.time() - chapter_start
            
            # Mark complete
            chapter.status = ChapterStatus.COMPLETED
            session.chapter_contents[chapter_id] = content
            session.progress["completed_chapters"] += 1
            session.progress["percentage"] = int(
                (session.progress["completed_chapters"] / session.progress["total_chapters"]) * 100
            )
            
            # Add to lesson data
            session.lesson_data["chapters"].append(content.to_dict())
            
            if progress_callback:
                progress_callback(100, 100, "completed", f"Chapter {chapter.chapter_number} complete")
            
            logger.info(f"Chapter {chapter.chapter_number} completed in {content.execution_time:.2f}s")
            
        except Exception as e:
            chapter.status = ChapterStatus.FAILED
            logger.error(f"Failed to generate chapter {chapter_id}: {e}")
            raise
        
        finally:
            session.progress["current_chapter"] = None
            session.progress["current_chapter_phase"] = None
            chapter_session_cache.update_session(session)
        
        return content
    
    def generate_all_chapters(
        self,
        session_id: str,
        progress_callback: Optional[Callable] = None,
        yield_chapters: bool = True
    ) -> Generator[ChapterContent, None, Dict[str, Any]]:
        """
        Generate all chapters one by one (iterator/generator pattern).
        
        Yields each chapter as it's completed, allowing incremental processing.
        
        Args:
            session_id: Session ID
            progress_callback: Progress callback
            yield_chapters: If True, yields each chapter as generated
        
        Yields:
            ChapterContent for each chapter
        
        Returns:
            Final lesson data when complete
        """
        session = chapter_session_cache.get_session(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")
        
        # Ensure we have outlines
        if not session.chapter_outlines:
            self.outline_chapters(session_id, progress_callback)
            session = chapter_session_cache.get_session(session_id)
        
        total_chapters = len(session.chapter_outlines)
        
        for i, chapter in enumerate(session.chapter_outlines):
            if chapter.status == ChapterStatus.COMPLETED:
                continue
            
            def chapter_progress(step, total, status, message):
                overall_pct = int(((i / total_chapters) + (step / total / total_chapters)) * 100)
                if progress_callback:
                    progress_callback(overall_pct, 100, status, message)
            
            content = self.generate_chapter(session_id, chapter.chapter_id, chapter_progress)
            
            if yield_chapters:
                yield content
        
        # Generate lesson conclusion
        session = chapter_session_cache.get_session(session_id)
        if progress_callback:
            progress_callback(95, 100, "finalizing", "Writing lesson conclusion...")
        
        session.lesson_data["conclusion"] = self._generate_lesson_conclusion(session)
        session.lesson_data["learning_objectives"] = self._extract_all_objectives(session)
        
        session.status = "completed"
        session.progress["phase"] = "completed"
        session.progress["percentage"] = 100
        session.timing["total_time"] = time.time() - session.timing["start_time"]
        chapter_session_cache.update_session(session)
        
        if progress_callback:
            progress_callback(100, 100, "completed", "Lesson generation complete")
        
        return session.lesson_data
    
    def generate_lesson(
        self,
        course_title: str,
        module_title: str,
        module_description: str,
        module_objectives: str,
        lesson_title: str,
        lesson_description: str = "",
        difficulty_level: str = "intermediate",
        existing_lessons: Optional[List[Dict[str, Any]]] = None,
        target_chapters: int = 5,
        chapter_depth: str = "deep",
        progress_callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        One-shot lesson generation using chapter-based approach.
        
        This is a convenience method that:
        1. Creates session
        2. Outlines chapters
        3. Generates each chapter sequentially
        4. Returns complete lesson
        """
        # Create session
        session_id = self.create_session(
            course_title, module_title, module_description, module_objectives,
            lesson_title, lesson_description, difficulty_level, existing_lessons,
            target_chapters, chapter_depth
        )
        
        # Outline chapters
        self.outline_chapters(session_id, progress_callback)
        
        # Generate all chapters
        for _ in self.generate_all_chapters(session_id, progress_callback):
            pass  # Just iterate to generate all
        
        # Get final result
        session = chapter_session_cache.get_session(session_id)
        return self._build_final_lesson(session)
    
    # ==========================================
    # PRIVATE METHODS - AI GENERATION
    # ==========================================
    
    def _analyze_topic(self, session: ChapterSession) -> Dict[str, Any]:
        """Analyze the lesson topic to understand scope and depth"""
        context = session.context
        
        prompt = f"""Perform a COMPREHENSIVE analysis of this lesson topic for an educational learning management system.

Course: {context.get('course_title')}
Module: {context.get('module_title')}
Module Description: {context.get('module_description')}
Module Objectives: {context.get('module_objectives')}

Lesson Title: {context.get('lesson_title')}
Lesson Description: {context.get('lesson_description', 'Not provided')}
Difficulty Level: {context.get('difficulty_level', 'intermediate')}
Target Depth: {context.get('chapter_depth', 'deep')}

Existing lessons in this module (to understand progression):
{json.dumps(context.get('existing_lessons', []), indent=2)}

Provide a DETAILED analysis in JSON format:
{{
    "topic_scope": "Comprehensive description (100+ words) of what this lesson should cover, including breadth and depth",
    "key_concepts": [
        "Core concept 1 with brief explanation",
        "Core concept 2 with brief explanation",
        "Core concept 3 with brief explanation",
        "Core concept 4 with brief explanation",
        "Core concept 5 with brief explanation"
    ],
    "prerequisite_knowledge": [
        "Prerequisite 1 - what learners should already know",
        "Prerequisite 2",
        "Prerequisite 3"
    ],
    "learning_goals": [
        "Specific measurable goal 1",
        "Specific measurable goal 2",
        "Specific measurable goal 3",
        "Specific measurable goal 4"
    ],
    "skills_developed": [
        "Practical skill 1",
        "Practical skill 2",
        "Practical skill 3"
    ],
    "suggested_depth": "shallow|standard|deep",
    "estimated_chapters": 5,
    "chapter_themes": [
        "Theme for chapter 1: Foundational concepts",
        "Theme for chapter 2: Core principles",
        "Theme for chapter 3: Practical application",
        "Theme for chapter 4: Advanced techniques",
        "Theme for chapter 5: Integration and mastery"
    ],
    "practical_applications": [
        "Real-world application 1 with specific example",
        "Real-world application 2 with specific example",
        "Real-world application 3"
    ],
    "industry_relevance": "How this topic is used in professional settings",
    "common_misconceptions": [
        "Misconception 1 that should be addressed",
        "Misconception 2 that should be addressed"
    ],
    "challenge_areas": [
        "Difficult concept 1 that needs careful explanation",
        "Difficult concept 2"
    ],
    "tools_or_technologies": ["Relevant tool 1", "Relevant tool 2"],
    "related_topics": ["Related topic for further learning 1", "Related topic 2"]
}}

Be thorough and specific - this analysis drives the entire lesson structure."""

        try:
            response = self.provider.generate_content(prompt)
            return json_parser.parse_json_response(response) or {}
        except Exception as e:
            logger.error(f"Topic analysis failed: {e}")
            return {
                "topic_scope": context.get('lesson_description', ''),
                "key_concepts": [],
                "estimated_chapters": context.get('target_chapters', 5)
            }
    
    def _generate_chapter_outline(self, session: ChapterSession, topic_analysis: Dict) -> Dict[str, Any]:
        """Generate detailed chapter outline based on topic analysis"""
        context = session.context
        target_chapters = context.get('target_chapters', 5)
        depth = context.get('chapter_depth', 'deep')
        
        prompt = f"""Design a COMPREHENSIVE chapter structure for this professional lesson.

Course: {context.get('course_title')}
Module: {context.get('module_title')}
Lesson: {context.get('lesson_title')}
Description: {context.get('lesson_description', '')}
Difficulty: {context.get('difficulty_level', 'intermediate')}
Required Depth: {depth.upper()}
Target Chapters: {target_chapters} (generate exactly this many unless topic requires adjustment)

Topic Analysis:
{json.dumps(topic_analysis, indent=2)}

REQUIREMENTS:
Create {target_chapters} detailed chapters that together provide COMPREHENSIVE coverage of the topic.

Return JSON:
{{
    "total_chapters": {target_chapters},
    "lesson_introduction": "A compelling introduction (150-200 words) that hooks the reader, explains the importance of the topic, and previews what they will learn across all chapters",
    "estimated_duration_minutes": 60,
    "chapters": [
        {{
            "chapter_number": 1,
            "title": "Descriptive Chapter Title",
            "description": "Detailed description (50+ words) of what this chapter covers and why it matters",
            "key_topics": [
                "Specific topic 1 with enough detail to understand scope",
                "Specific topic 2",
                "Specific topic 3",
                "Specific topic 4"
            ],
            "learning_objectives": [
                "By the end of this chapter, learners will be able to [SPECIFIC MEASURABLE SKILL]",
                "Learners will understand [SPECIFIC CONCEPT] and apply it to [SPECIFIC SITUATION]",
                "Learners will be able to [ACTION VERB] [SPECIFIC OUTCOME]"
            ],
            "estimated_subsections": 4,
            "includes_examples": true,
            "includes_exercises": true,
            "estimated_duration_minutes": 12
        }}
    ]
}}

CHAPTER DESIGN REQUIREMENTS:
1. Chapter 1: Foundation - Core concepts, definitions, fundamentals
2. Middle Chapters: Progressive depth - Build on previous concepts, add complexity
3. Practical Chapters: Real-world applications, examples, case studies
4. Final Chapter: Advanced topics, integration, or comprehensive review

Each chapter should:
- Be substantial enough for 10-15 minutes of learning
- Have 4-5 specific key topics (not vague)
- Have 2-3 measurable learning objectives
- Build logically on previous chapters
- Include both theory and practical elements"""

        try:
            response = self.provider.generate_content(prompt)
            return json_parser.parse_json_response(response) or {"chapters": []}
        except Exception as e:
            logger.error(f"Chapter outline generation failed: {e}")
            return self._fallback_chapter_outline(context, target_chapters)
    
    def _parse_chapter_outline(self, outline_result: Dict, session: ChapterSession) -> List[ChapterOutline]:
        """Parse the outline result into ChapterOutline objects"""
        chapters = []
        
        # Store lesson introduction
        session.lesson_data["introduction"] = outline_result.get("lesson_introduction", "")
        
        for chapter_data in outline_result.get("chapters", []):
            chapter = ChapterOutline(
                chapter_id=f"chapter_{chapter_data.get('chapter_number', len(chapters)+1)}",
                chapter_number=chapter_data.get("chapter_number", len(chapters)+1),
                title=chapter_data.get("title", f"Chapter {len(chapters)+1}"),
                description=chapter_data.get("description", ""),
                key_topics=chapter_data.get("key_topics", []),
                learning_objectives=chapter_data.get("learning_objectives", []),
                estimated_sections=chapter_data.get("estimated_subsections", 3),
                status=ChapterStatus.PENDING
            )
            chapters.append(chapter)
        
        return chapters
    
    def _generate_chapter_introduction(self, session: ChapterSession, chapter: ChapterOutline) -> str:
        """Generate introduction for a specific chapter"""
        context = session.context
        
        # Get previous chapters for context
        prev_chapters = [
            c.title for c in session.chapter_outlines 
            if c.chapter_number < chapter.chapter_number
        ]
        
        prompt = f"""Write a comprehensive, engaging introduction for this educational chapter.

Course: {context.get('course_title')}
Module: {context.get('module_title')}
Lesson: {context.get('lesson_title')}
Chapter {chapter.chapter_number}: {chapter.title}
Description: {chapter.description}
Difficulty Level: {context.get('difficulty_level', 'intermediate')}

Key Topics to Cover in This Chapter:
{json.dumps(chapter.key_topics, indent=2)}

Learning Objectives:
{json.dumps(chapter.learning_objectives, indent=2)}

Previous Chapters Covered: {', '.join(prev_chapters) if prev_chapters else 'This is the first chapter'}

REQUIREMENTS - Write a COMPREHENSIVE introduction (minimum 400-600 words) that includes:

1. **Opening Hook** (1 paragraph):
   - Start with a compelling real-world scenario, problem, or question
   - Make the reader immediately understand why this topic matters
   - Include a specific example or statistic if relevant

2. **Context and Relevance** (1-2 paragraphs):
   - Explain where this fits in the bigger picture
   - Connect to what was learned before (if applicable)
   - Describe real-world applications and use cases
   - Explain why professionals need to understand this

3. **Chapter Overview** (1-2 paragraphs):
   - Clearly state what will be covered in detail
   - Preview the main sections and topics
   - Set expectations for what skills they will gain
   - Mention any tools, techniques, or concepts that will be introduced

4. **Learning Objectives Statement** (1 paragraph):
   - Rephrase the objectives in an engaging way
   - Be specific about measurable outcomes
   - Connect objectives to practical applications

Write in a professional, educational tone that is engaging but not casual.
Use markdown formatting with bold for emphasis.
Do NOT use headers in the introduction - it should flow as continuous prose."""

        try:
            response = self.provider.generate_content(prompt)
            return response.strip()
        except Exception as e:
            logger.error(f"Chapter introduction generation failed: {e}")
            return f"In this chapter, we'll explore {chapter.title}. {chapter.description}"
    
    def _generate_chapter_theory(self, session: ChapterSession, chapter: ChapterOutline) -> Dict[str, Any]:
        """Generate deep theory content with subsections for a chapter"""
        context = session.context
        depth = context.get('chapter_depth', 'deep')
        
        subsection_config = {
            'shallow': {'count': 3, 'words_per': 400},
            'standard': {'count': 4, 'words_per': 600},
            'deep': {'count': 5, 'words_per': 800}
        }.get(depth, {'count': 4, 'words_per': 600})
        
        prompt = f"""Generate COMPREHENSIVE, IN-DEPTH educational content for this chapter.

Course: {context.get('course_title')}
Module: {context.get('module_title')}
Lesson: {context.get('lesson_title')}
Chapter {chapter.chapter_number}: {chapter.title}
Description: {chapter.description}
Difficulty: {context.get('difficulty_level', 'intermediate')}
Required Depth: {depth.upper()}

Key Topics That MUST Be Covered:
{json.dumps(chapter.key_topics, indent=2)}

Learning Objectives to Achieve:
{json.dumps(chapter.learning_objectives, indent=2)}

CRITICAL REQUIREMENTS:
1. Generate {subsection_config['count']} or more detailed subsections
2. Each subsection MUST be {subsection_config['words_per']}+ words
3. Include SPECIFIC examples with real data, formulas, or code
4. Explain concepts step-by-step, not just definitions
5. Include practical applications for each concept
6. Use tables, lists, and formatted content where appropriate

Return JSON with this EXACT structure:
{{
    "content": "Main chapter overview (200-300 words) that introduces the theoretical foundation and what will be covered",
    "subsections": [
        {{
            "title": "Descriptive Subsection Title",
            "content": "COMPREHENSIVE content ({subsection_config['words_per']}+ words) including:\\n- Detailed explanations of concepts\\n- Step-by-step breakdowns\\n- Real-world examples with SPECIFIC DATA\\n- Formulas or code snippets where relevant\\n- Common misconceptions addressed\\n- Best practices and tips\\n- Use markdown formatting (bold, lists, code blocks)",
            "key_points": ["Specific actionable point 1", "Specific actionable point 2", "Specific actionable point 3"],
            "depth_level": "foundational|intermediate|advanced",
            "practical_tip": "A specific, actionable tip professionals can use immediately"
        }}
    ]
}}

CONTENT QUALITY REQUIREMENTS:
- DO NOT write generic, superficial content
- Include SPECIFIC examples with actual numbers, data, formulas
- Explain the "how" and "why", not just the "what"
- Include step-by-step procedures where applicable
- Reference industry standards or best practices
- Address common mistakes and how to avoid them
- Make content actionable and practical
- Use proper technical terminology with explanations
- Include visual descriptions (describe charts, diagrams conceptually)

Each subsection should teach something concrete that the reader can apply immediately."""

        try:
            response = self.provider.generate_content(prompt)
            result = json_parser.parse_json_response(response)
            if result:
                return result
        except Exception as e:
            logger.error(f"Chapter theory generation failed: {e}")
        
        # Fallback
        return {
            "content": f"This section covers {chapter.title}. {chapter.description}",
            "subsections": []
        }
    
    def _generate_chapter_examples(
        self, 
        session: ChapterSession, 
        chapter: ChapterOutline,
        content: ChapterContent
    ) -> List[Dict[str, Any]]:
        """Generate practical examples for a chapter"""
        context = session.context
        depth = context.get('chapter_depth', 'deep')
        
        example_count = {'shallow': 2, 'standard': 3, 'deep': 4}.get(depth, 3)
        
        prompt = f"""Create DETAILED, PRACTICAL examples for this educational chapter.

Course: {context.get('course_title')}
Lesson: {context.get('lesson_title')}
Chapter: {chapter.title}
Topics: {json.dumps(chapter.key_topics)}
Difficulty: {context.get('difficulty_level', 'intermediate')}

Chapter Theory Covered:
{content.theory_content[:2000]}

REQUIREMENTS:
Generate {example_count} comprehensive, real-world examples that demonstrate the concepts taught.

Return JSON:
{{
    "examples": [
        {{
            "title": "Descriptive Example Title",
            "scenario": "Detailed real-world scenario (100+ words) with specific context, company/situation details, and why this example matters",
            "given_data": "Specific data, numbers, values provided for this example (use realistic data)",
            "problem": "Clear statement of what needs to be solved or demonstrated (50+ words)",
            "solution_steps": [
                "Step 1: Detailed first step with specific actions",
                "Step 2: Second step with calculations or procedures",
                "Step 3: Continue with all necessary steps",
                "Step 4: Final step showing the result"
            ],
            "solution": "Complete detailed solution (200+ words) showing all work, calculations, formulas used, and final answer with units/context",
            "explanation": "Thorough explanation (150+ words) of why this solution works, what principles are applied, and what the result means",
            "code_or_formula": "Include actual formulas, Excel formulas, code snippets, or mathematical expressions used",
            "visual_description": "Describe any chart, table, or diagram that would help visualize this example",
            "key_insight": "One important insight or takeaway from this example",
            "common_mistakes": ["Mistake 1 to avoid", "Mistake 2 to avoid"],
            "complexity": "basic|intermediate|advanced"
        }}
    ]
}}

EXAMPLE QUALITY REQUIREMENTS:
- Use REALISTIC data with actual numbers
- Show ALL calculation steps
- Include proper formulas or code
- Progress from simpler to more complex examples
- Make examples relevant to real professional scenarios
- Each example should teach a specific skill or concept
- Include variations or edge cases where relevant"""

        try:
            response = self.provider.generate_content(prompt)
            result = json_parser.parse_json_response(response)
            if result and "examples" in result:
                return result["examples"]
        except Exception as e:
            logger.error(f"Chapter examples generation failed: {e}")
        
        return []
    
    def _generate_chapter_exercises(
        self,
        session: ChapterSession,
        chapter: ChapterOutline,
        content: ChapterContent
    ) -> List[Dict[str, Any]]:
        """Generate exercises for a chapter"""
        context = session.context
        depth = context.get('chapter_depth', 'deep')
        
        exercise_count = {'shallow': 3, 'standard': 5, 'deep': 7}.get(depth, 5)
        
        prompt = f"""Create COMPREHENSIVE practice exercises for this educational chapter.

Course: {context.get('course_title')}
Lesson: {context.get('lesson_title')}
Chapter: {chapter.title}
Learning Objectives: {json.dumps(chapter.learning_objectives)}
Difficulty: {context.get('difficulty_level', 'intermediate')}

Chapter Topics Covered:
{json.dumps(chapter.key_topics)}

REQUIREMENTS:
Generate {exercise_count} detailed practice exercises with COMPLETE solutions.

Return JSON:
{{
    "exercises": [
        {{
            "exercise_number": 1,
            "type": "calculation|analysis|application|critical_thinking|hands_on|case_study",
            "difficulty": "easy|medium|hard",
            "title": "Descriptive Exercise Title",
            "scenario": "Real-world context for the exercise (if applicable)",
            "given_data": "Specific data, values, or information provided",
            "question": "Clear, specific question or task (100+ words). Be explicit about what is required.",
            "requirements": ["Requirement 1", "Requirement 2", "Requirement 3"],
            "hints": [
                "Hint 1: A helpful clue without giving away the answer",
                "Hint 2: Another useful pointer"
            ],
            "solution": {{
                "approach": "Explanation of how to approach this problem",
                "steps": [
                    "Step 1: First action with details",
                    "Step 2: Continue with calculations",
                    "Step 3: Show all work",
                    "Step 4: Final answer with proper units"
                ],
                "final_answer": "The complete answer with all necessary details",
                "formula_or_code": "Any formulas, Excel formulas, or code used"
            }},
            "explanation": "Detailed explanation (100+ words) of WHY this solution is correct and what concepts it reinforces",
            "learning_reinforced": ["Concept 1 practiced", "Concept 2 applied"],
            "extension_challenge": "An optional harder variation of this exercise"
        }}
    ]
}}

EXERCISE QUALITY REQUIREMENTS:
- Mix of difficulty levels (easy, medium, hard)
- Include various types (calculations, analysis, application)
- Provide COMPLETE, detailed solutions
- Use realistic scenarios and data
- Make exercises progressively challenging
- Include practical, job-relevant problems
- Solutions should show all work step-by-step
- Avoid simple yes/no or definition questions"""

        try:
            response = self.provider.generate_content(prompt)
            result = json_parser.parse_json_response(response)
            if result and "exercises" in result:
                return result["exercises"]
        except Exception as e:
            logger.error(f"Chapter exercises generation failed: {e}")
        
        return []
    
    def _generate_chapter_summary(
        self,
        session: ChapterSession,
        chapter: ChapterOutline,
        content: ChapterContent
    ) -> Dict[str, Any]:
        """Generate comprehensive summary and key takeaways for a chapter"""
        context = session.context
        
        # Get next chapter for transition if available
        next_chapter = None
        for c in session.chapter_outlines:
            if c.chapter_number == chapter.chapter_number + 1:
                next_chapter = c
                break
        
        prompt = f"""Write a COMPREHENSIVE summary for this educational chapter.

Course: {context.get('course_title')}
Lesson: {context.get('lesson_title')}
Chapter {chapter.chapter_number}: {chapter.title}
Topics Covered: {json.dumps(chapter.key_topics)}
Learning Objectives: {json.dumps(chapter.learning_objectives)}

Chapter Content Overview:
{content.theory_content[:2500]}

Examples Covered: {len(content.examples)} practical examples
Exercises Included: {len(content.exercises)} practice exercises

{f"Next Chapter: {next_chapter.title}" if next_chapter else "This is the final chapter"}

Return JSON:
{{
    "summary": "A comprehensive summary (300-400 words) that:\\n- Recaps ALL main concepts covered\\n- Highlights key definitions and principles\\n- Connects theory to practical applications\\n- Reinforces the most important takeaways\\n- Provides context for how this fits in the bigger picture",
    "key_takeaways": [
        "SPECIFIC takeaway 1 - what exactly the learner can now do",
        "SPECIFIC takeaway 2 - a key concept with its practical application",
        "SPECIFIC takeaway 3 - an important principle or rule to remember",
        "SPECIFIC takeaway 4 - a best practice or professional tip",
        "SPECIFIC takeaway 5 - how this connects to real-world scenarios"
    ],
    "quick_reference": [
        "Formula or concept 1: Brief explanation",
        "Formula or concept 2: Brief explanation",
        "Key term: Definition"
    ],
    "common_pitfalls": [
        "Common mistake 1 and how to avoid it",
        "Common mistake 2 and how to avoid it"
    ],
    "next_steps": "What the learner should do next or what the next chapter will cover"
}}

SUMMARY QUALITY REQUIREMENTS:
- Be SPECIFIC, not generic
- Reference actual concepts and terms from the chapter
- Include actionable insights
- Make it useful as a quick review reference
- Connect to professional practice"""

        try:
            response = self.provider.generate_content(prompt)
            result = json_parser.parse_json_response(response)
            if result:
                return result
        except Exception as e:
            logger.error(f"Chapter summary generation failed: {e}")
        
        return {
            "summary": f"This chapter covered {chapter.title}.",
            "key_takeaways": chapter.learning_objectives
        }
    
    def _generate_lesson_conclusion(self, session: ChapterSession) -> str:
        """Generate overall lesson conclusion"""
        context = session.context
        chapter_titles = [c.title for c in session.chapter_outlines]
        
        # Gather key takeaways from all chapters
        all_takeaways = []
        for chapter_content in session.chapter_contents.values():
            if hasattr(chapter_content, 'key_takeaways'):
                all_takeaways.extend(chapter_content.key_takeaways[:2])
        
        prompt = f"""Write a COMPREHENSIVE conclusion for this complete professional lesson.

Course: {context.get('course_title')}
Module: {context.get('module_title')}
Lesson: {context.get('lesson_title')}
Difficulty: {context.get('difficulty_level', 'intermediate')}

Chapters Covered:
{json.dumps(chapter_titles, indent=2)}

Total Chapters: {len(chapter_titles)}
Key Concepts Across All Chapters: {all_takeaways[:10] if all_takeaways else 'Various concepts covered'}

Write a COMPREHENSIVE conclusion (400-500 words) that includes:

1. **Lesson Recap** (1 paragraph):
   - Summarize the learning journey through all chapters
   - Highlight how concepts built upon each other
   - Reference specific topics covered

2. **Key Accomplishments** (1 paragraph):
   - State what the learner can now do
   - Connect to professional skills gained
   - Mention specific tools or techniques mastered

3. **Practical Application** (1 paragraph):
   - Explain how to apply this knowledge in real situations
   - Give specific scenarios where these skills are valuable
   - Encourage immediate practice

4. **Common Challenges & Tips** (1 paragraph):
   - Acknowledge potential difficulties
   - Provide tips for continued success
   - Suggest best practices

5. **Next Steps** (1 paragraph):
   - Recommend further learning topics
   - Suggest resources or advanced topics
   - Encourage continued exploration

Write in an encouraging but professional educational tone.
Use markdown formatting with **bold** for emphasis on key terms.
Make the conclusion feel like a proper wrap-up of substantial learning."""

        try:
            response = self.provider.generate_content(prompt)
            return response.strip()
        except Exception as e:
            logger.error(f"Lesson conclusion generation failed: {e}")
            return "Congratulations on completing this lesson!"
    
    def _extract_all_objectives(self, session: ChapterSession) -> List[str]:
        """Extract all learning objectives from chapters"""
        objectives = []
        for chapter in session.chapter_outlines:
            objectives.extend(chapter.learning_objectives)
        return objectives
    
    def _build_final_lesson(self, session: ChapterSession) -> Dict[str, Any]:
        """Build the final lesson structure"""
        return {
            "session_id": session.session_id,
            "title": session.lesson_data["title"],
            "description": session.lesson_data["description"],
            "introduction": session.lesson_data["introduction"],
            "learning_objectives": session.lesson_data["learning_objectives"],
            "chapters": session.lesson_data["chapters"],
            "conclusion": session.lesson_data["conclusion"],
            "total_chapters": len(session.chapter_outlines),
            "generation_report": {
                "total_time": session.timing.get("total_time", 0),
                "outline_time": session.timing.get("outline_time", 0),
                "chapters_generated": session.progress["completed_chapters"],
                "status": session.status
            }
        }
    
    def _fallback_chapter_outline(self, context: Dict, target_chapters: int) -> Dict[str, Any]:
        """Fallback chapter outline if AI fails"""
        lesson_title = context.get('lesson_title', 'Lesson')
        return {
            "total_chapters": target_chapters,
            "lesson_introduction": f"Welcome to {lesson_title}.",
            "chapters": [
                {
                    "chapter_number": 1,
                    "title": "Introduction and Fundamentals",
                    "description": "Core concepts and foundations",
                    "key_topics": ["Overview", "Key Terms"],
                    "learning_objectives": ["Understand the basics"],
                    "estimated_subsections": 2
                },
                {
                    "chapter_number": 2,
                    "title": "Core Concepts",
                    "description": "Main theoretical concepts",
                    "key_topics": ["Theory", "Principles"],
                    "learning_objectives": ["Master core concepts"],
                    "estimated_subsections": 3
                },
                {
                    "chapter_number": 3,
                    "title": "Practical Application",
                    "description": "Applying knowledge in practice",
                    "key_topics": ["Examples", "Use Cases"],
                    "learning_objectives": ["Apply concepts practically"],
                    "estimated_subsections": 3
                },
                {
                    "chapter_number": 4,
                    "title": "Advanced Topics",
                    "description": "Deeper exploration",
                    "key_topics": ["Advanced Concepts", "Best Practices"],
                    "learning_objectives": ["Handle advanced scenarios"],
                    "estimated_subsections": 2
                },
                {
                    "chapter_number": 5,
                    "title": "Review and Practice",
                    "description": "Consolidation and exercises",
                    "key_topics": ["Review", "Practice"],
                    "learning_objectives": ["Solidify understanding"],
                    "estimated_subsections": 2
                }
            ][:target_chapters]
        }


# Create singleton instance
chapter_based_generator = ChapterBasedLessonGenerator()
