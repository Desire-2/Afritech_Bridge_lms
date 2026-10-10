"""Form-aware module creation agent."""

from .form_agent import FormAwareAgent


class ModuleCreationAgent(FormAwareAgent):
    agent_type = "module_creation_agent"
    profile = "curriculum"
    title = "Module Creation Agent"
    domain = "module creation"
    default_fields = ("title", "description", "learning_objectives", "order", "is_published")
    instructions = """Use the course objectives, existing module titles and order to create
the next coherent module. Avoid repeating an existing module and keep ordering
compatible with the current course."""
