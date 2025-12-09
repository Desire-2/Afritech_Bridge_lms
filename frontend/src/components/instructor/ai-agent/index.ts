/**
 * AI Agent Components for Instructor Course Creation
 * Exports all AI-assisted content generation components
 */

export { AICourseGenerator } from './AICourseGenerator';
export { AIContentGenerator } from './AIContentGenerator';

// Re-export types
export type { 
  CourseOutlineRequest,
  ModuleContentRequest,
  LessonContentRequest,
  QuizQuestionsRequest,
  AssignmentRequest,
  FinalProjectRequest,
  EnhanceContentRequest,
  AIResponse
} from '@/services/ai-agent.service';
