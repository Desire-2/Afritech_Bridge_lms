"""
Fallback Content Generators Module
Provides fallback content when AI generation fails
"""

import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


class FallbackGenerators:
    """Provides fallback content when AI generation fails"""
    
    @staticmethod
    def generate_fallback_lesson(title: str, description: str, difficulty: str, report: Dict) -> Dict:
        """Generate a basic fallback lesson when AI generation fails"""
        logger.error("Generating fallback lesson due to generation failures")
        report["steps_failed"].append("Full generation failed - using fallback")
        
        return {
            "title": title,
            "description": description or f"An introduction to {title}",
            "learning_objectives": "• Understand core concepts\n• Apply basic principles\n• Practice fundamental skills",
            "duration_minutes": 60,
            "difficulty_level": difficulty,
            "content_type": "text",
            "content_data": f"# {title}\n\nThis lesson is under development. Please check back soon for complete content.",
            "generation_report": report,
            "metadata": {
                "error": "Generation failed",
                "fallback_used": True
            }
        }
    
    @staticmethod
    def generate_fallback_introduction(title: str) -> str:
        """Generate basic introduction when AI fails"""
        return f"""## Introduction

Welcome to this lesson on {title}. In this comprehensive lesson, we will explore the fundamental concepts, practical applications, and hands-on exercises to build your understanding and skills.

### What You'll Learn

This lesson covers the essential knowledge and practical skills needed to master {title}. We'll progress from foundational concepts to advanced applications, ensuring you gain both theoretical understanding and practical competence.

### Why This Matters

Understanding {title} is crucial for your development in this field. These concepts form the foundation for more advanced topics and have wide-ranging applications in real-world scenarios.

Let's begin our learning journey!"""
    
    @staticmethod
    def generate_fallback_theory(concepts: str) -> str:
        """Generate basic theory section when AI fails"""
        return f"""## Theoretical Foundation

### Core Concepts

This section covers the fundamental theoretical concepts: {concepts}.

Each concept builds upon previous knowledge and contributes to your overall understanding of the subject matter.

### Key Principles

The core principles governing these concepts include:
- Fundamental definitions and terminology
- Relationships between concepts
- Theoretical frameworks and models
- Mathematical or logical foundations

### Further Study

Additional theoretical content will be provided. Please refer to the course materials and additional resources for comprehensive coverage."""
    
    @staticmethod
    def generate_fallback_practical(title: str) -> str:
        """Generate basic practical section when AI fails"""
        return f"""## Practical Applications

### Real-World Use Cases

The concepts in {title} have numerous practical applications across various domains and industries.

### Examples

Practical examples and demonstrations will help you understand how to apply theoretical knowledge in real situations.

### Best Practices

Following industry best practices ensures effective application of these concepts in professional settings.

### Hands-On Practice

Practice problems and exercises are available to reinforce your learning and build practical skills."""
    
    @staticmethod
    def generate_fallback_exercises(title: str) -> str:
        """Generate basic exercises section when AI fails"""
        return f"""## Practice Exercises

### Concept Check Questions

1. What are the key concepts covered in {title}?
2. How do these concepts relate to each other?
3. What are the main applications of these concepts?

### Applied Problems

1. Apply the concepts learned to solve a practical problem in your domain.
2. Design a solution that demonstrates your understanding.
3. Explain your reasoning and approach.

### Self-Assessment

Evaluate your understanding:
- [ ] I can explain the core concepts
- [ ] I can apply concepts to new situations
- [ ] I can solve related problems independently
- [ ] I understand the practical applications"""
    
    @staticmethod
    def generate_fallback_summary(title: str, concepts: str) -> str:
        """Generate basic summary when AI fails"""
        return f"""## Summary & Key Takeaways

### Lesson Recap

In this lesson on {title}, we covered: {concepts}.

### Essential Takeaways

1. Understanding the fundamental concepts is crucial
2. Practical application reinforces theoretical knowledge
3. Regular practice leads to mastery
4. Connecting concepts helps build comprehensive understanding

### Reflection Questions

1. How can you apply what you've learned?
2. What aspects would you like to explore further?
3. How does this connect to your previous knowledge?

### Additional Resources

Continue your learning journey by exploring:
- Recommended textbooks and academic papers
- Online courses and tutorials
- Practice platforms and coding challenges
- Community forums and discussion groups

Keep practicing and exploring!"""
    
    @staticmethod
    def generate_fallback_mixed_content(lesson_title: str, template_id: str = None) -> Dict[str, Any]:
        """Generate fallback mixed content structure"""
        sections = [
            {"type": "heading", "content": "Introduction", "title": "Introduction"},
            {"type": "text", "content": f"## Introduction\n\nWelcome to {lesson_title}. In this lesson, you will learn key concepts.\n\n### Learning Objectives\n\n- Understand the fundamentals\n- Apply knowledge practically\n- Build real-world skills"},
            {"type": "video", "url": "[INSERT_VIDEO_URL_HERE]", "title": "Main Lecture Video"},
            {"type": "heading", "content": "Summary", "title": "Summary"},
            {"type": "text", "content": "## Key Takeaways\n\n- Important point 1\n- Important point 2\n- Important point 3"}
        ]
        
        return {
            "sections": sections,
            "lesson_title": lesson_title,
            "template_used": template_id
        }


# Singleton instance
fallback_generators = FallbackGenerators()
