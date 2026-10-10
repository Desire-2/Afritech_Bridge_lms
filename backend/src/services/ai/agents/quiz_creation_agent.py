"""Form-aware quiz creation agent."""

from .form_agent import FormAwareAgent


class QuizCreationAgent(FormAwareAgent):
    agent_type = "quiz_creation_agent"
    profile = "assessment_generation"
    title = "Quiz Creation Agent"
    domain = "quiz creation"
    default_fields = (
        "title", "description", "module_id", "lesson_id", "time_limit",
        "max_attempts", "passing_score", "points_possible", "questions",
    )
    instructions = """Write questions only from the supplied lesson content and objectives.
Use the question/answer structure supplied by the form. Every answer-based
question must have one and only one correct answer; never invent a question type
the form does not support. Avoid duplicates and ambiguous wording."""
