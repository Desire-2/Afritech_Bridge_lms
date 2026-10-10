"""Form-aware capstone project agent."""

from .form_agent import FormAwareAgent


class ProjectCreationAgent(FormAwareAgent):
    agent_type = "project_creation_agent"
    profile = "assessment_generation"
    title = "Project Creation Agent"
    domain = "project creation"
    default_fields = (
        "title", "description", "objectives", "module_ids", "due_date",
        "points_possible", "passing_score", "submission_format", "tasks",
        "collaboration_allowed", "max_team_size", "allowed_file_types",
        "max_file_size_mb", "is_published",
    )
    instructions = """Create a realistic practical project that integrates the supplied
course/module/lesson outcomes. State concrete tasks, deliverables and evaluation
criteria in the actual fields. Do not turn a technical project into a generic essay."""
