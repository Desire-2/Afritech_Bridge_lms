"""Form-aware course creation and course-level improvement agent."""

from .form_agent import FormAwareAgent


class CourseCreationAgent(FormAwareAgent):
    agent_type = "course_creation_agent"
    profile = "planning"
    title = "Course Creation Agent"
    domain = "course creation"
    default_fields = (
        "title", "description", "learning_objectives", "target_audience",
        "estimated_duration", "difficulty_level", "thumbnail_url",
    )
    instructions = """Reason about the course as a whole. Generate measurable objectives,
an appropriate audience and duration, and a coherent description. Do not generate
modules or lessons unless the instruction explicitly asks for them."""
