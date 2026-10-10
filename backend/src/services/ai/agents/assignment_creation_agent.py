"""Form-aware assignment creation agent."""

from .form_agent import FormAwareAgent


class AssignmentCreationAgent(FormAwareAgent):
    agent_type = "assignment_creation_agent"
    profile = "assessment_generation"
    title = "Assignment Creation Agent"
    domain = "assignment creation"
    default_fields = (
        "title", "description", "instructions", "assignment_type", "module_id",
        "lesson_id", "points_possible", "passing_score", "due_date",
        "rubric_criteria", "allowed_file_types", "max_file_size_mb", "is_published",
    )
    instructions = """Design a practical assignment aligned with the selected lesson or
module. Include clear deliverables, constraints and grading criteria only where
the current form supports them. Do not silently choose a deadline."""
