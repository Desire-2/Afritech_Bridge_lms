"""Configurable skill taxonomy and course-outcome mapping defaults.

Skill names are never hard-coded in routes or components: this module is the
single source for definitions, translations and the default course → skill
mapping, which itself is derived from the LMS's existing
``src.config.course_skill_profiles`` configuration.
"""

from __future__ import annotations

from ..config.course_skill_profiles import get_skill_profile_for_course
from ..models.course_models import Course
from .enums import MAPPING_COURSE_OUTCOME
from .models import CourseSkillMapping, SkillCategory, SkillDefinition, db

# (key, name, fr, rw, category, source_profile_key, criteria)
CATEGORIES = [
    ("technical", "Technical skills", "Compétences techniques", "Ubuhanga bwa tekinike",
     "Skills demonstrated through practical, technical work."),
    ("professional", "Professional skills", "Compétences professionnelles", "Ubuhanga bw'umwuga",
     "Transferable workplace capabilities."),
    ("digital", "Digital foundations", "Fondamentaux numériques", "Iby'ibanze bya digitale",
     "Foundational digital capability."),
]

SKILLS = [
    ("html", "HTML", "HTML", "HTML", "technical", "web_development",
     "Structure web pages using semantic HTML."),
    ("css", "CSS", "CSS", "CSS", "technical", "web_development",
     "Style responsive interfaces with CSS."),
    ("javascript", "JavaScript", "JavaScript", "JavaScript", "technical", "web_development",
     "Implement interactive behaviour with JavaScript."),
    ("frontend_development", "Frontend Development", "Développement frontend", "Guteza imbere imbere", "technical", "web_development",
     "Build accessible, responsive user interfaces."),
    ("backend_development", "Backend Development", "Développement backend", "Guteza imbere inyuma", "technical", "backend_development",
     "Build and maintain server-side application logic."),
    ("python", "Python Programming", "Programmation Python", "Gukoresha Python", "technical", "python",
     "Write and debug Python programs."),
    ("sql", "SQL", "SQL", "SQL", "technical", "data_analysis",
     "Query and model relational data with SQL."),
    ("excel", "Microsoft Excel", "Microsoft Excel", "Microsoft Excel", "technical", "excel",
     "Analyse data with formulas, charts and pivot tables."),
    ("data_analysis", "Data Analysis", "Analyse de données", "Gusesengura amakuru", "technical", "data_analysis",
     "Clean, analyse and communicate insights from data."),
    ("ui_ux_design", "UI/UX Design", "Design UI/UX", "Igishushanyo mbonera cy'ikoreshwa", "technical", "graphic_design",
     "Design usable, accessible interfaces."),
    ("graphic_design", "Graphic Design", "Design graphique", "Igishushanyo cy'ishusho", "technical", "graphic_design",
     "Create visual communication assets."),
    ("digital_marketing", "Digital Marketing", "Marketing numérique", "Kwamamaza kuri digitale", "technical", "digital_marketing",
     "Plan and measure digital campaigns."),
    ("digital_literacy", "Digital Literacy", "Culture numérique", "Ubumenyi bwa digitale", "digital", "general",
     "Use common digital tools effectively and safely."),
    ("communication", "Communication", "Communication", "Itumanaho", "professional", None,
     "Communicate ideas clearly to different audiences."),
    ("problem_solving", "Problem-solving", "Résolution de problèmes", "Gukemura ibibazo", "professional", None,
     "Analyse problems and implement effective solutions."),
    ("teamwork", "Teamwork", "Travail en équipe", "Gukorera hamwe", "professional", None,
     "Contribute effectively in a team."),
    ("research", "Research", "Recherche", "Ubushakashatsi", "professional", None,
     "Find, evaluate and synthesise information."),
    ("presentation", "Presentation", "Présentation", "Kwerekana", "professional", None,
     "Present work and explain decisions."),
    ("critical_thinking", "Critical Thinking", "Esprit critique", "Gutekereza byimbitse", "professional", None,
     "Evaluate evidence and justify conclusions."),
]

# Which skills a course profile implies a student is *learning*. This only
# creates LEARNING records; demonstrated/verified requires real evidence.
PROFILE_TO_SKILLS = {
    "excel": ("excel", "data_analysis"),
    "python": ("python", "problem_solving"),
    "web_development": ("html", "css", "javascript", "frontend_development"),
    "graphic_design": ("graphic_design", "ui_ux_design"),
    "data_analysis": ("data_analysis", "sql", "excel"),
    "backend_development": ("backend_development", "python", "sql"),
    "digital_marketing": ("digital_marketing", "communication"),
    "general": ("digital_literacy",),
}


def ensure_taxonomy():
    """Idempotently create categories and skill definitions."""
    created = 0
    category_ids = {}
    for key, name, fr, rw, description in CATEGORIES:
        category = SkillCategory.query.filter_by(key=key).first()
        if category is None:
            category = SkillCategory(
                key=key, name=name, name_fr=fr, name_rw=rw,
                description=description, sort_order=CATEGORIES.index((key, name, fr, rw, description)),
            )
            db.session.add(category)
            db.session.flush()
            created += 1
        category_ids[key] = category.id

    for index, (key, name, fr, rw, category_key, profile_key, description) in enumerate(SKILLS):
        skill = SkillDefinition.query.filter_by(key=key).first()
        if skill is None:
            skill = SkillDefinition(
                key=key, name=name, name_fr=fr, name_rw=rw,
                category_id=category_ids[category_key],
                source_profile_key=profile_key, description=description, sort_order=index,
            )
            db.session.add(skill)
            db.session.flush()
            created += 1
    return created


def ensure_default_course_mappings(course: Course):
    """Create default mappings from the LMS's existing course skill profile.

    These are system-authored *learning* mappings. Administrators/instructors
    may edit or remove them; the Passport never invents higher statuses from
    them. Returns the number of newly created mappings.
    """
    ensure_taxonomy()
    profile = get_skill_profile_for_course(course.title, getattr(course, "category", None))
    keys = PROFILE_TO_SKILLS.get(profile["profile_key"], ())
    definitions = {
        definition.key: definition
        for definition in SkillDefinition.query.filter(SkillDefinition.key.in_(keys)).all()
    }

    created = 0
    for key in keys:
        definition = definitions.get(key)
        if not definition:
            continue
        existing = CourseSkillMapping.query.filter_by(
            course_id=course.id,
            skill_definition_id=definition.id,
            source_type=MAPPING_COURSE_OUTCOME,
            source_id=0,
        ).first()
        if existing:
            continue
        db.session.add(CourseSkillMapping(
            course_id=course.id,
            skill_definition_id=definition.id,
            source_type=MAPPING_COURSE_OUTCOME,
            source_id=0,
            competency_criteria=definition.description,
        ))
        db.session.flush()
        created += 1
    return created


def skill_display(definition: SkillDefinition, language: str = "en") -> str:
    """Translated display name with a stable fallback."""
    if language == "fr" and definition.name_fr:
        return definition.name_fr
    if language == "rw" and definition.name_rw:
        return definition.name_rw
    return definition.name
