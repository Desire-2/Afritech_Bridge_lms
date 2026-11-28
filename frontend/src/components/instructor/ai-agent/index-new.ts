/**
 * AI Agent Components for Instructor Course Creation
 * Exports all AI-assisted content generation components
 */

// Enhanced AI Agent Components
export { default as EnhancedAIContentGenerator } from './EnhancedAIContentGenerator';
export { default as AIProgressTracker } from './AIProgressTracker';
export { default as QualityAssessmentDisplay } from './QualityAssessmentDisplay';

// Legacy Components
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
  AIResponse,
  GenerationProgress,
  QualityAssessment
} from '@/services/ai-agent.service';
