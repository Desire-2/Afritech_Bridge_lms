"""Form-aware lesson metadata agent."""

from .form_agent import FormAwareAgent


class LessonCreationAgent(FormAwareAgent):
    agent_type = "lesson_creation_agent"
    profile = "lesson_generation"
    title = "Lesson Creation Agent"
    domain = "lesson creation"
    default_fields = (
        "title", "description", "learning_objectives", "content_type",
        "duration_minutes", "order", "is_published",
    )
    instructions = """Generate lesson metadata and sequencing only. Use the module and
course objectives, previous lessons, expected duration and difficulty. Do not
write lesson content unless content_data is explicitly part of the supplied form."""
