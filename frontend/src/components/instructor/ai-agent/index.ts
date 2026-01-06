/**
 * AI Agent Components for Instructor Course Creation
 * Exports all AI-assisted content generation components
 */

// Main Components
export { AICourseGenerator } from './AICourseGenerator';
export { AIContentGenerator } from './AIContentGenerator';
export { AIDashboard } from './AIDashboard';
export { AIIntegration } from './AIIntegration';

// Enhanced Components
export { default as EnhancedAIContentGenerator } from './EnhancedAIContentGenerator';
export { AIProgressTracker } from './AIProgressTracker';
export { default as QualityAssessmentDisplay } from './QualityAssessmentDisplay';

// Admin Components
export { AIAdminPanel } from './AIAdminPanel';

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
