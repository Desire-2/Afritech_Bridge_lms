"""
Comprehensive Lesson Generation Module
Handles step-by-step validated lesson generation with professor-level quality
"""

import time
import logging
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime

from .ai_providers import ai_provider_manager
from .json_parser import json_parser
from .content_validator import ContentValidator
from .fallback_generators import fallback_generators

logger = logging.getLogger(__name__)


class ComprehensiveLessonGenerator:
    """Generates comprehensive, validated lessons step-by-step"""
    
    def __init__(self, provider_manager=None):
        self.provider = provider_manager or ai_provider_manager
        self.validator = ContentValidator()
    
    def generate_comprehensive_lesson_step_by_step(self, course_title: str, module_title: str,
                                                   module_description: str, module_objectives: str,
                                                   lesson_title: str, lesson_description: str = "",
                                                   difficulty_level: str = "intermediate",
                                                   existing_lessons: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Generate a comprehensive, professor-level lesson in multiple steps
        
        Args:
            course_title: Parent course title
            module_title: Parent module title
            module_description: Module description for context
            module_objectives: Module learning objectives
            lesson_title: Lesson title
            lesson_description: Brief lesson description
            difficulty_level: 'beginner', 'intermediate', or 'advanced'
            existing_lessons: List of existing lessons for context
            
        Returns:
            Dict with complete lesson content and generation progress
        """
        logger.info(f"Starting comprehensive lesson generation: {lesson_title}")
        
        existing_context = self._build_existing_context(existing_lessons)
        
        todo_steps = []
        generated_content = {
            "title": lesson_title,
            "description": lesson_description,
            "difficulty_level": difficulty_level,
            "sections": {},
            "metadata": {
                "estimated_duration_minutes": 0,
                "prerequisites": [],
                "learning_outcomes": [],
                "key_concepts": []
            }
        }
        
        # STEP 1: Generate lesson outline
        logger.info("Step 1/6: Generating lesson outline and structure...")
        todo_steps.append("✓ Generate lesson outline")
        
        outline_data = self._generate_outline(
            course_title, module_title, module_description, 
            module_objectives, lesson_title, lesson_description,
            difficulty_level, existing_context
        )
        
        if outline_data:
            generated_content["description"] = outline_data.get("description", lesson_description)
            generated_content["metadata"]["prerequisites"] = outline_data.get("prerequisites", [])
            generated_content["metadata"]["learning_outcomes"] = outline_data.get("learning_outcomes", [])
            generated_content["metadata"]["key_concepts"] = outline_data.get("key_concepts", [])
            generated_content["metadata"]["estimated_duration_minutes"] = outline_data.get("total_duration_minutes", 60)
            generated_content["metadata"]["assessment_methods"] = outline_data.get("assessment_methods", [])
        else:
            logger.warning("Failed to generate outline, using default structure")
        
        # STEP 2: Generate Introduction
        logger.info("Step 2/6: Generating introduction...")
        todo_steps.append("✓ Generate introduction")
        intro_result = self._generate_introduction(
            lesson_title, generated_content, existing_lessons
        )
        if intro_result:
            generated_content["sections"]["introduction"] = intro_result.strip()
        
        # STEP 3: Generate Theoretical Foundation
        logger.info("Step 3/6: Generating theoretical foundation...")
        todo_steps.append("✓ Generate theoretical content")
        theory_result = self._generate_theory(
            lesson_title, generated_content, difficulty_level
        )
        if theory_result:
            generated_content["sections"]["theoretical_foundation"] = theory_result.strip()
        
        # STEP 4: Generate Practical Applications
        logger.info("Step 4/6: Generating practical applications...")
        todo_steps.append("✓ Generate practical applications")
        practical_result = self._generate_practical(
            lesson_title, generated_content, difficulty_level
        )
        if practical_result:
            generated_content["sections"]["practical_applications"] = practical_result.strip()
        
        # STEP 5: Generate Exercises
        logger.info("Step 5/6: Generating exercises and assessments...")
        todo_steps.append("✓ Generate exercises and assessments")
        exercises_result = self._generate_exercises(
            lesson_title, generated_content, difficulty_level
        )
        if exercises_result:
            generated_content["sections"]["exercises"] = exercises_result.strip()
        
        # STEP 6: Generate Summary
        logger.info("Step 6/6: Generating summary and resources...")
        todo_steps.append("✓ Generate summary and resources")
        summary_result = self._generate_summary(
            lesson_title, generated_content
        )
        if summary_result:
            generated_content["sections"]["summary"] = summary_result.strip()
        
        # Compile complete lesson
        complete_content = self._assemble_complete_lesson(lesson_title, generated_content, difficulty_level)
        
        logger.info(f"Lesson generation complete: {lesson_title}")
        
        return {
            "title": lesson_title,
            "description": generated_content['description'],
            "learning_objectives": "\n".join(f"• {outcome}" for outcome in generated_content['metadata']['learning_outcomes']),
            "duration_minutes": generated_content['metadata']['estimated_duration_minutes'],
            "difficulty_level": difficulty_level,
            "prerequisites": generated_content['metadata']['prerequisites'],
            "key_concepts": generated_content['metadata']['key_concepts'],
            "assessment_methods": generated_content['metadata'].get('assessment_methods', []),
            "content_type": "text",
            "content_data": complete_content,
            "sections": generated_content['sections'],
            "generation_steps": todo_steps,
            "metadata": generated_content['metadata']
        }
    
    def generate_comprehensive_lesson_with_validation(self, course_title: str, module_title: str,
                                                      module_description: str, module_objectives: str,
                                                      lesson_title: str, lesson_description: str = "",
                                                      difficulty_level: str = "intermediate",
                                                      existing_lessons: Optional[List[Dict[str, Any]]] = None,
                                                      progress_callback: Optional[Callable] = None) -> Dict[str, Any]:
        """
        Generate a comprehensive, professor-level lesson with validation at each step
        
        This is an enhanced version that validates each section before proceeding.
        """
        logger.info(f"Starting ENHANCED comprehensive lesson generation: {lesson_title}")
        
        total_steps = 7
        current_step = 0
        
        def update_progress(status: str, message: str):
            nonlocal current_step
            current_step += 1
            logger.info(f"Step {current_step}/{total_steps}: {message}")
            if progress_callback:
                progress_callback(current_step, total_steps, status, message)
        
        generation_report = {
            "steps_completed": [],
            "steps_failed": [],
            "validation_results": {},
            "total_generation_time": 0,
            "quality_scores": {}
        }
        
        start_time = time.time()
        
        existing_context = self._build_existing_context(existing_lessons)
        prerequisite_knowledge = []
        if existing_lessons and len(existing_lessons) > 0:
            prerequisite_knowledge = [f"Completion of: {lesson['title']}" for lesson in existing_lessons[-3:]]
        
        generated_content = {
            "title": lesson_title,
            "description": lesson_description,
            "difficulty_level": difficulty_level,
            "sections": {},
            "metadata": {
                "estimated_duration_minutes": 0,
                "prerequisites": prerequisite_knowledge,
                "learning_outcomes": [],
                "key_concepts": [],
                "assessment_methods": []
            }
        }
        
        # STEP 1: Generate Outline
        update_progress("running", "Designing lesson architecture and learning framework...")
        
        outline_data = self._generate_detailed_outline(
            course_title, module_title, module_description, module_objectives,
            lesson_title, lesson_description, difficulty_level, existing_context
        )
        
        if not outline_data:
            generation_report["steps_failed"].append("Lesson outline generation failed")
            update_progress("error", "Failed to generate lesson outline")
            return fallback_generators.generate_fallback_lesson(lesson_title, lesson_description, difficulty_level, generation_report)
        
        generated_content["description"] = outline_data.get("description", lesson_description)
        generated_content["metadata"]["prerequisites"].extend(outline_data.get("prerequisites", []))
        generated_content["metadata"]["learning_outcomes"] = outline_data.get("learning_outcomes", [])
        generated_content["metadata"]["key_concepts"] = outline_data.get("key_concepts", [])
        generated_content["metadata"]["estimated_duration_minutes"] = outline_data.get("total_duration_minutes", 90)
        generated_content["metadata"]["assessment_methods"] = outline_data.get("assessment_methods", [])
        
        generation_report["steps_completed"].append("Lesson outline")
        generation_report["quality_scores"]["outline"] = 100
        
        learning_outcomes_str = "\n".join(f"{i}. {outcome}" for i, outcome in enumerate(generated_content['metadata']['learning_outcomes'], 1))
        key_concepts_str = ", ".join(generated_content['metadata']['key_concepts'])
        
        # STEP 2-6: Generate each section with validation
        sections_config = [
            ("introduction", "Crafting engaging introduction with academic rigor...", 600),
            ("theoretical_foundation", "Developing comprehensive theoretical foundation...", 1200),
            ("practical_applications", "Creating detailed practical applications and examples...", 1200),
            ("exercises", "Designing comprehensive practice exercises and assessments...", 1000),
            ("summary", "Compiling summary, key takeaways, and resources...", 800),
        ]
        
        for section_name, message, min_length in sections_config:
            update_progress("running", message)
            
            content = self._generate_section_with_validation(
                section_name, lesson_title, generated_content, difficulty_level,
                existing_lessons, learning_outcomes_str, key_concepts_str, existing_context,
                generation_report, min_length
            )
            
            if content:
                generated_content["sections"][section_name] = content
        
        # STEP 7: Compile Complete Lesson
        update_progress("running", "Compiling complete lesson document...")
        
        quality_scores = list(generation_report["quality_scores"].values())
        avg_quality = sum(quality_scores) / len(quality_scores) if quality_scores else 0
        
        complete_content = self._assemble_complete_lesson(lesson_title, generated_content, difficulty_level)
        
        generation_report["total_generation_time"] = time.time() - start_time
        generation_report["average_quality_score"] = avg_quality
        generation_report["sections_generated"] = len(generated_content["sections"])
        generation_report["total_word_count"] = len(complete_content.split())
        
        logger.info(f"Lesson generation complete: {lesson_title} - Time: {generation_report['total_generation_time']:.1f}s, Quality: {avg_quality:.1f}/100")
        
        update_progress("completed", f"Lesson generated successfully! Quality score: {avg_quality:.1f}/100")
        
        return {
            "title": lesson_title,
            "description": generated_content['description'],
            "learning_objectives": "\n".join(f"• {outcome}" for outcome in generated_content['metadata']['learning_outcomes']),
            "duration_minutes": generated_content['metadata']['estimated_duration_minutes'],
            "difficulty_level": difficulty_level,
            "prerequisites": generated_content['metadata']['prerequisites'],
            "key_concepts": generated_content['metadata']['key_concepts'],
            "assessment_methods": generated_content['metadata']['assessment_methods'],
            "content_type": "text",
            "content_data": complete_content,
            "sections": generated_content['sections'],
            "generation_report": generation_report,
            "metadata": generated_content['metadata'],
            "quality_metrics": {
                "average_score": avg_quality,
                "individual_scores": generation_report["quality_scores"],
                "validation_passed": avg_quality >= 70
            }
        }
    
    def _build_existing_context(self, existing_lessons: Optional[List[Dict[str, Any]]]) -> str:
        """Build context string from existing lessons"""
        if not existing_lessons or len(existing_lessons) == 0:
            return ""
        
        context = f"\n\nPREVIOUS LESSONS ({len(existing_lessons)}):\n"
        for idx, lesson in enumerate(existing_lessons, 1):
            context += f"{idx}. {lesson['title']}\n"
            if lesson.get('description'):
                context += f"   - {lesson['description']}\n"
        context += f"\nThis lesson should build upon these previous lessons and cover NEW content."
        return context
    
    def _generate_outline(self, course_title: str, module_title: str,
                         module_description: str, module_objectives: str,
                         lesson_title: str, lesson_description: str,
                         difficulty_level: str, existing_context: str) -> Optional[Dict]:
        """Generate basic lesson outline"""
        prompt = f"""You are a university professor creating a lesson outline.

Course: {course_title}
Module: {module_title}
Module Description: {module_description}
Module Objectives: {module_objectives}{existing_context}
Lesson Title: {lesson_title}
Description: {lesson_description or "To be determined"}
Difficulty: {difficulty_level}

Create a lesson outline with:
1. Refined description (2-3 sentences)
2. Prerequisites (3-5)
3. Learning outcomes (4-6, using Bloom's Taxonomy)
4. Key concepts (5-8)
5. Total duration (minutes)
6. Assessment methods (3-5)

Format as JSON:
{{
  "description": "Academic description",
  "prerequisites": ["Prereq 1", "Prereq 2"],
  "learning_outcomes": ["Outcome 1", "Outcome 2"],
  "key_concepts": ["Concept 1", "Concept 2"],
  "total_duration_minutes": 60,
  "assessment_methods": ["Quiz", "Exercise"]
}}"""
        
        result, _ = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=2048)
        return json_parser.parse_json_response(result, "lesson outline") if result else None
    
    def _generate_detailed_outline(self, course_title: str, module_title: str,
                                   module_description: str, module_objectives: str,
                                   lesson_title: str, lesson_description: str,
                                   difficulty_level: str, existing_context: str) -> Optional[Dict]:
        """Generate detailed lesson outline for validated generation"""
        prompt = f"""You are a DISTINGUISHED UNIVERSITY PROFESSOR with PhD-level expertise.

COURSE CONTEXT:
Course: {course_title}
Module: {module_title}
Module Description: {module_description}
Module Objectives: {module_objectives}{existing_context}

LESSON DETAILS:
Title: {lesson_title}
Focus: {lesson_description or "To be determined"}
Level: {difficulty_level.capitalize()}

Create a DETAILED lesson blueprint:

1. **REFINED LESSON DESCRIPTION** (3-4 sentences)
2. **PREREQUISITES** (3-5 specific requirements)
3. **LEARNING OUTCOMES** (5-7 using Bloom's Taxonomy verbs: Analyze, Evaluate, Create, Apply)
4. **KEY CONCEPTS** (6-10 concepts)
5. **TOTAL DURATION** (typically 60-90 minutes)
6. **ASSESSMENT METHODS** (4-6 methods)

Return ONLY valid JSON:
{{
  "description": "Comprehensive academic description",
  "prerequisites": ["Prerequisite 1", "Prerequisite 2", "Prerequisite 3"],
  "learning_outcomes": [
    "Analyze [concept] to determine [outcome]",
    "Evaluate [approach] using [criteria]",
    "Create [solution] that demonstrates [skill]"
  ],
  "key_concepts": ["Concept 1", "Concept 2", "Concept 3"],
  "total_duration_minutes": 90,
  "assessment_methods": ["Concept check questions", "Practical exercises", "Quiz", "Project"]
}}"""
        
        result, _ = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=3000)
        return json_parser.parse_json_response(result, "detailed outline") if result else None
    
    def _generate_introduction(self, lesson_title: str, content: Dict, 
                              existing_lessons: Optional[List]) -> Optional[str]:
        """Generate lesson introduction"""
        prompt = f"""You are a DISTINGUISHED UNIVERSITY PROFESSOR writing a COMPREHENSIVE introduction for '{lesson_title}'.

LEARNING OUTCOMES: {', '.join(content['metadata']['learning_outcomes'])}
KEY CONCEPTS: {', '.join(content['metadata']['key_concepts'])}

===== REQUIREMENTS: Write 600-800 words =====

1. **OPENING HOOK** (150+ words):
   - Start with a compelling real-world scenario, surprising fact, or thought-provoking question
   - Include a SPECIFIC industry example with named company or real situation
   - Make the reader immediately understand the professional importance
   - Include a statistic or data point if relevant

2. **CONTEXT AND RELEVANCE** (150+ words):
   - Explain where this topic fits in the broader field
   - Describe 2-3 specific real-world applications{" and how it builds on previous lessons" if existing_lessons else ""}
   - Explain why professionals MUST understand this
   - Reference industry standards or trends

3. **DETAILED OVERVIEW** (150+ words):
   - Clearly state what will be covered in each major section
   - Preview the specific skills and knowledge to be gained
   - Set clear expectations about complexity and depth

4. **MOTIVATION AND ROADMAP** (150+ words):
   - Describe 3-4 specific career scenarios where this knowledge is essential
   - Explain how mastering this leads to professional advancement
   - List the 4-6 learning objectives in an engaging way

Use **bold** for key terms, *italics* for emphasis, > blockquotes for important insights.
DO NOT write generic content - be SPECIFIC with examples, data, and applications.
Return ONLY markdown content - NO JSON wrapping."""
        
        result, _ = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=2500)
        return result
    
    def _generate_theory(self, lesson_title: str, content: Dict, 
                        difficulty_level: str) -> Optional[str]:
        """Generate theoretical foundation section"""
        prompt = f"""You are a DISTINGUISHED PROFESSOR with PhD-level expertise writing COMPREHENSIVE theoretical content for '{lesson_title}' at {difficulty_level} level.

KEY CONCEPTS TO COVER IN DEPTH: {', '.join(content['metadata']['key_concepts'])}

===== REQUIREMENTS: Write 1500-2000 words =====

Create content with this EXACT structure:

## Theoretical Foundation

### 1. Core Concepts and Definitions (400+ words)
For EACH key concept:
- Provide a precise **definition** with proper terminology
- Explain the concept in detail (not just 1-2 sentences)
- Give a SPECIFIC example with actual data/numbers
- Explain why this concept matters in practice
- Address common misconceptions

### 2. Fundamental Principles (300+ words)
- Explain the underlying principles that govern this topic
- Show how principles connect to each other
- Include any formulas, rules, or laws with explanations
- Provide step-by-step procedures where applicable

### 3. Theoretical Framework (300+ words)
- Present the systematic approach to understanding this topic
- Explain the structure and relationships between components
- Include diagrams descriptions (describe what a diagram would show)
- Reference industry frameworks or standards

### 4. Professional Context (200+ words)
- How these concepts apply in real industry settings
- Best practices and professional standards
- Common challenges professionals face
- Expert tips and insights

### 5. Advanced Considerations (200+ words)
- Edge cases and special scenarios
- How this connects to more advanced topics
- Current trends and developments
- What experts focus on

===== CONTENT QUALITY REQUIREMENTS =====
- Include SPECIFIC examples with real data, numbers, formulas
- Explain the "how" and "why", not just the "what"
- Use tables where comparing multiple items
- Use `code` formatting for technical notation, formulas, or commands
- DO NOT write generic or superficial content
- Every paragraph must add substantive educational value

Return ONLY markdown content - NO JSON wrapping."""
        
        result, _ = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=5000)
        return result
    
    def _generate_practical(self, lesson_title: str, content: Dict,
                           difficulty_level: str) -> Optional[str]:
        """Generate practical applications section"""
        prompt = f"""You are a SENIOR INDUSTRY EXPERT writing COMPREHENSIVE practical applications for '{lesson_title}' at {difficulty_level} level.

CONCEPTS TO APPLY: {', '.join(content['metadata']['key_concepts'])}

===== REQUIREMENTS: Write 1500-2000 words =====

## Practical Applications

### 1. Real-World Use Cases (400+ words)
Provide 4 detailed use cases:
For EACH use case:
- **Scenario**: Named company or specific industry situation (50+ words)
- **Challenge**: The problem they faced
- **Application**: How the concepts from this lesson apply
- **Outcome**: Specific results with numbers/metrics if applicable

### 2. Worked Examples (700+ words)
Provide 3 FULLY WORKED examples:

#### Example 1: [Title] - Basic Application
**Scenario** (100+ words): [Realistic professional context with specific details]
**Given Data**: [Specific numbers, values, inputs]
**Solution Steps**:
1. [First step with calculations/actions]
2. [Second step with formulas if applicable]
3. [Continue with all necessary steps]
4. [Final step showing result]
**Result**: [Answer with proper units and interpretation]
**Key Insight**: [What this example teaches]

#### Example 2: [Title] - Intermediate Application
[Same detailed structure as Example 1 but more complex]

#### Example 3: [Title] - Advanced Application
[Same detailed structure with advanced scenario]

### 3. Professional Best Practices (300+ words)
- 5-7 specific best practices with explanations
- Industry standards and benchmarks
- Tips from experienced professionals
- Tools and resources professionals use

### 4. Common Pitfalls and How to Avoid Them (200+ words)
- 4-5 common mistakes with explanations
- How to identify when you're making these mistakes
- Specific techniques to avoid each pitfall

===== QUALITY REQUIREMENTS =====
- Use REALISTIC data with actual numbers
- Show ALL calculation steps
- Include formulas, code, or Excel formulas where relevant
- Make examples progressively more complex
- Be specific - no generic or vague content

Return ONLY markdown content - NO JSON wrapping."""
        
        result, _ = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=5000)
        return result
    
    def _generate_exercises(self, lesson_title: str, content: Dict,
                           difficulty_level: str) -> Optional[str]:
        """Generate exercises section"""
        prompt = f"""You are an EXPERT EDUCATOR creating COMPREHENSIVE practice exercises for '{lesson_title}' at {difficulty_level} level.

LEARNING OUTCOMES TO ASSESS: {', '.join(content['metadata']['learning_outcomes'])}
KEY CONCEPTS: {', '.join(content['metadata']['key_concepts'])}

===== REQUIREMENTS: Write 1200-1500 words =====

## Practice Exercises

### Concept Check Questions (5-7 questions)
For EACH question:
- **Question**: Clear, specific question testing understanding
- **Answer**: Complete answer with explanation

### Applied Problems (4-5 problems with FULL SOLUTIONS)

#### Problem 1: [Title] ⭐ Easy
**Scenario**: [Realistic context]
**Given**: [Specific data]
**Question**: [What to solve]
**Hints**:
1. [Helpful hint 1]
2. [Helpful hint 2]
**Solution**:
- Step 1: [First step with work shown]
- Step 2: [Continue]
- Final Answer: [Complete answer with units]
**Explanation**: [Why this solution works]

#### Problem 2: [Title] ⭐⭐ Medium
[Same structure with moderate complexity]

#### Problem 3: [Title] ⭐⭐ Medium
[Same structure]

#### Problem 4: [Title] ⭐⭐⭐ Hard
[Same structure with advanced complexity]

#### Problem 5: [Title] ⭐⭐⭐ Hard (Optional Challenge)
[Same structure with challenging scenario]

### Critical Thinking Challenges (2-3 open-ended)
For EACH:
- Scenario requiring analysis
- Multiple aspects to consider
- Sample response approach

### Self-Assessment Checklist
- [ ] I can define [key concept 1] and explain why it matters
- [ ] I can apply [concept] to solve [type of problem]
- [ ] I can identify [common issue] and correct it
- [ ] I can explain the relationship between [concept A] and [concept B]
- [ ] I can perform [specific skill] independently
- [ ] I can analyze [type of scenario] and recommend solutions

===== QUALITY REQUIREMENTS =====
- All problems must have COMPLETE solutions with all steps
- Use realistic data and scenarios
- Progress from easy to hard
- Include hints for harder problems
- Explain reasoning in solutions

Return ONLY markdown content - NO JSON wrapping."""
        
        result, _ = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=4000)
        return result
    
    def _generate_summary(self, lesson_title: str, content: Dict) -> Optional[str]:
        """Generate summary section"""
        prompt = f"""You are a MASTER EDUCATOR writing a COMPREHENSIVE summary for '{lesson_title}'.

KEY CONCEPTS COVERED: {', '.join(content['metadata']['key_concepts'])}
LEARNING OUTCOMES: {', '.join(content['metadata']['learning_outcomes'])}

===== REQUIREMENTS: Write 800-1000 words =====

## Summary and Key Takeaways

### Lesson Recap (200+ words)
- Comprehensive recap of ALL main concepts covered
- How the concepts build upon each other
- The key skills and knowledge gained
- Why this matters for professional practice

### Essential Takeaways (300+ words)
Provide 8-10 SPECIFIC, ACTIONABLE takeaways:

1. **[Takeaway Title]**: [Specific actionable point with context - not generic]
2. **[Takeaway Title]**: [What exactly the learner can now do]
3. **[Takeaway Title]**: [Key concept with its practical application]
4. [Continue with specific, valuable takeaways...]

### Quick Reference Guide (150+ words)
- Key formulas or procedures in a table or list
- Important definitions to remember
- Common values or benchmarks
- Decision frameworks or checklists

### Common Mistakes to Avoid (100+ words)
- 4-5 common pitfalls with brief explanations
- How to recognize each mistake
- Quick fixes

### Reflection Questions (100+ words)
1. How would you apply [concept] to [specific scenario in your work]?
2. What challenges might you face when implementing [skill]?
3. How does [concept A] relate to [concept B] in practice?
4. What would you do differently now when approaching [type of problem]?

### Additional Resources (100+ words)
- 3-4 recommended readings with descriptions
- Online tools or software to explore
- Advanced topics for further study
- Industry communities or forums

===== QUALITY REQUIREMENTS =====
- Be SPECIFIC - no generic statements like "understand the basics"
- Every takeaway should be immediately actionable
- Reference actual concepts from the lesson
- Make it useful as a quick review reference

Return ONLY markdown content - NO JSON wrapping."""
        
        result, _ = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=3000)
        return result
    
    def _generate_section_with_validation(self, section_name: str, lesson_title: str,
                                         content: Dict, difficulty_level: str,
                                         existing_lessons: Optional[List],
                                         learning_outcomes_str: str, key_concepts_str: str,
                                         existing_context: str, report: Dict,
                                         min_length: int) -> Optional[str]:
        """Generate a section with validation and retry logic"""
        generators = {
            "introduction": lambda: self._generate_introduction(lesson_title, content, existing_lessons),
            "theoretical_foundation": lambda: self._generate_theory(lesson_title, content, difficulty_level),
            "practical_applications": lambda: self._generate_practical(lesson_title, content, difficulty_level),
            "exercises": lambda: self._generate_exercises(lesson_title, content, difficulty_level),
            "summary": lambda: self._generate_summary(lesson_title, content),
        }
        
        content_type_map = {
            "introduction": "introduction",
            "theoretical_foundation": "theory",
            "practical_applications": "examples",
            "exercises": "exercises",
            "summary": "summary"
        }
        
        generator = generators.get(section_name)
        if not generator:
            return None
        
        result = generator()
        
        if result:
            validation = self.validator.validate_content_quality(
                result, content_type_map.get(section_name, "general"), min_length
            )
            report["validation_results"][section_name] = validation
            report["quality_scores"][section_name] = validation["quality_score"]
            
            if validation["valid"]:
                report["steps_completed"].append(section_name.replace("_", " ").title())
                return result.strip()
            else:
                logger.warning(f"{section_name} validation failed, retrying...")
                result = generator()
                if result:
                    report["steps_completed"].append(f"{section_name.replace('_', ' ').title()} (retry)")
                    return result.strip()
        
        fallback_map = {
            "introduction": lambda: fallback_generators.generate_fallback_introduction(lesson_title),
            "theoretical_foundation": lambda: fallback_generators.generate_fallback_theory(key_concepts_str),
            "practical_applications": lambda: fallback_generators.generate_fallback_practical(lesson_title),
            "exercises": lambda: fallback_generators.generate_fallback_exercises(lesson_title),
            "summary": lambda: fallback_generators.generate_fallback_summary(lesson_title, key_concepts_str),
        }
        
        fallback = fallback_map.get(section_name)
        if fallback:
            report["steps_failed"].append(section_name.replace("_", " ").title())
            return fallback()
        
        return None
    
    def _assemble_complete_lesson(self, lesson_title: str, content: Dict[str, Any], difficulty: str) -> str:
        """Assemble all sections into a complete lesson document"""
        duration = content['metadata']['estimated_duration_minutes']
        outcomes = content['metadata']['learning_outcomes']
        prerequisites = content['metadata']['prerequisites']
        key_concepts = content['metadata']['key_concepts']
        
        lesson_doc = f"""# {lesson_title}

{content['description']}

---

## 📋 Lesson Overview

**Duration**: {duration} minutes ({duration // 60}h {duration % 60}min)  
**Difficulty Level**: {difficulty.capitalize()}  
**Last Updated**: {datetime.now().strftime('%B %d, %Y')}

### Prerequisites
{chr(10).join(f"- {prereq}" for prereq in prerequisites)}

### Learning Outcomes
{chr(10).join(f"{i}. {outcome}" for i, outcome in enumerate(outcomes, 1))}

### Key Concepts
{', '.join(f"**{concept}**" for concept in key_concepts)}

---

"""
        
        sections = content['sections']
        section_order = ['introduction', 'theoretical_foundation', 'practical_applications', 'exercises', 'summary']
        
        for section_name in section_order:
            if section_name in sections:
                lesson_doc += sections[section_name] + "\n\n---\n\n"
        
        lesson_doc += """
## 🎓 Lesson Complete!

Congratulations on completing this comprehensive lesson!

### Next Steps
1. ✅ Review the key takeaways
2. 📝 Complete all practice exercises
3. 🔍 Explore the additional resources
4. 💬 Participate in discussions
5. 🚀 Apply these concepts in your projects

---

*Remember: Mastery comes through practice and application. Keep pushing forward!* 🌟
"""
        
        return lesson_doc


# Singleton instance
comprehensive_lesson_generator = ComprehensiveLessonGenerator()
