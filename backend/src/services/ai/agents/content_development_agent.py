"""Form-aware lesson content agent."""

from .form_agent import FormAwareAgent


class ContentDevelopmentAgent(FormAwareAgent):
    agent_type = "content_development_agent"
    profile = "lesson_generation"
    title = "Content Development Agent"
    domain = "lesson content editor"
    default_fields = ("content_data", "content_type", "description", "learning_objectives")
    instructions = """Teach the stated lesson objectives with specific, practical content.
Respect the current content_type: text content is clean Markdown; mixed content
must use the editor's existing JSON structure. Use the course, module, lesson,
previous-lesson and target-audience context. If asked to improve content, preserve
the useful parts and make the requested change rather than changing the lesson."""
