/**
 * AI Agent Service for Afritec Bridge LMS Frontend
 * Integrates with Gemini API and backend AI agent endpoints
 */

import apiClient from '@/lib/api-client';
import axios from 'axios';

// Create a special client for AI requests with longer timeout
const aiApiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1',
  timeout: 120000, // 120 seconds (2 minutes) for AI generation
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token interceptor
aiApiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export interface CourseOutlineRequest {
  topic: string;
  target_audience?: string;
  learning_objectives?: string;
}

export interface ModuleContentRequest {
  course_id: number;
  module_title?: string;
}

export interface MultipleModulesRequest {
  course_id: number;
  num_modules?: number;
}

export interface MultipleLessonsRequest {
  course_id: number;
  module_id: number;
  num_lessons?: number;
}

export interface LessonContentRequest {
  course_id: number;
  module_id: number;
  lesson_title?: string;
  lesson_description?: string;
}

export interface QuizQuestionsRequest {
  course_id: number;
  module_id: number;
  lesson_id?: number;
  num_questions?: number;
  question_types?: string[];
}

export interface AssignmentRequest {
  course_id: number;
  module_id: number;
}

export interface FinalProjectRequest {
  course_id: number;
}

export interface EnhanceContentRequest {
  content_type: string;
  current_content: string;
  enhancement_type?: 'improve' | 'expand' | 'simplify' | 'add_examples';
}

export interface QuizFromContentRequest {
  course_id: number;
  content_type: 'lesson' | 'module';
  lesson_id?: number;
  module_id?: number;
  num_questions?: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
}

export interface AssignmentFromContentRequest {
  course_id: number;
  content_type: 'lesson' | 'module';
  lesson_id?: number;
  module_id?: number;
  assignment_type?: 'practical' | 'theoretical' | 'project' | 'mixed';
}

export interface ProjectFromContentRequest {
  course_id: number;
  module_id: number;
}

export interface AIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  metadata?: {
    timestamp: string;
    duration_ms: number;
    cache_hit: boolean;
    provider_used: string;
    session_id: string;
    quality_score?: number;
  };
  status?: 'success' | 'partial_success' | 'error';
}

// Progress tracking interface
export interface GenerationProgress {
  session_id: string;
  progress: number;
  stage: string;
  estimated_remaining: number;
  can_cancel: boolean;
}

// Quality assessment interface
export interface QualityAssessment {
  overall_score: number;
  is_valid: boolean;
  quality_breakdown: {
    [aspect: string]: {
      score: number;
      feedback: string;
      suggestions: string[];
    };
  };
  critical_issues: string[];
  warnings: string[];
  suggestions: string[];
}

class AIAgentService {
  private progressCallbacks: Map<string, (progress: GenerationProgress) => void> = new Map();
  
  /**
   * Check AI agent service health and configuration
   */
  async healthCheck(): Promise<{
    status: string;
    api_configured: boolean;
    provider_stats?: any;
    message: string;
  }> {
    try {
      const response = await aiApiClient.get('/ai-agent/health');
      return response.data;
    } catch (error: any) {
      console.error('Health check failed:', error);
      return {
        status: 'error',
        api_configured: false,
        message: error.response?.data?.message || 'Health check failed'
      };
    }
  }
  
  /**
   * Track generation progress for long-running operations
   */
  async trackProgress(sessionId: string, onProgress: (progress: GenerationProgress) => void): Promise<void> {
    this.progressCallbacks.set(sessionId, onProgress);
    
    const pollProgress = async () => {
      try {
        const response = await aiApiClient.get(`/ai-agent/progress/${sessionId}`);
        const progress: GenerationProgress = response.data;
        
        onProgress(progress);
        
        // Continue polling if not complete
        if (progress.progress < 100) {
          setTimeout(pollProgress, 1000); // Poll every second
        } else {
          this.progressCallbacks.delete(sessionId);
        }
      } catch (error) {
        console.error('Progress tracking error:', error);
        this.progressCallbacks.delete(sessionId);
      }
    };
    
    pollProgress();
  }
  
  /**
   * Cancel ongoing generation
   */
  async cancelGeneration(sessionId: string): Promise<void> {
    try {
      await aiApiClient.post(`/ai-agent/cancel/${sessionId}`);
      this.progressCallbacks.delete(sessionId);
    } catch (error) {
      console.error('Cancel generation failed:', error);
    }
  }
  /**
   * Generate course outline using AI
   */
  async generateCourseOutline(request: CourseOutlineRequest): Promise<AIResponse> {
    try {
      const response = await aiApiClient.post('/ai-agent/generate-course-outline', request);
      return response.data;
    } catch (error: any) {
      console.error('Error generating course outline:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate course outline',
        error: error.message
      };
    }
  }

  /**
   * Generate module content using AI
   */
  async generateModuleContent(request: ModuleContentRequest): Promise<AIResponse> {
    try {
      const response = await aiApiClient.post('/ai-agent/generate-module-content', request);
      return response.data;
    } catch (error: any) {
      console.error('Error generating module content:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate module content',
        error: error.message
      };
    }
  }

  /**
   * Generate multiple modules at once using AI
   */
  async generateMultipleModules(request: MultipleModulesRequest): Promise<AIResponse> {
    try {
      const response = await aiApiClient.post('/ai-agent/generate-multiple-modules', request);
      return response.data;
    } catch (error: any) {
      console.error('Error generating multiple modules:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate multiple modules',
        error: error.message
      };
    }
  }

  /**
   * Generate multiple lessons at once using AI
   */
  async generateMultipleLessons(request: MultipleLessonsRequest): Promise<AIResponse> {
    try {
      const response = await aiApiClient.post('/ai-agent/generate-multiple-lessons', request);
      return response.data;
    } catch (error: any) {
      console.error('Error generating multiple lessons:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate multiple lessons',
        error: error.message
      };
    }
  }

  /**
   * Generate lesson content with enhanced quality tracking
   */
  async generateLessonContent(
    request: LessonContentRequest, 
    onProgress?: (progress: GenerationProgress) => void
  ): Promise<AIResponse> {
    try {
      // Start the generation
      const response = await aiApiClient.post('/ai-agent/generate-lesson-content', {
        ...request,
        track_progress: !!onProgress
      });
      
      // If progress tracking requested and session_id provided
      if (onProgress && response.data.metadata?.session_id) {
        this.trackProgress(response.data.metadata.session_id, onProgress);
      }
      
      return response.data;
    } catch (error: any) {
      console.error('Error generating lesson content:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate lesson content',
        error: error.message
      };
    }
  }
  
  /**
   * Generate module content with enhanced features
   */
  async generateModuleContentEnhanced(
    request: ModuleContentRequest,
    options?: {
      trackProgress?: boolean;
      qualityThreshold?: number;
    }
  ): Promise<AIResponse> {
    try {
      const response = await aiApiClient.post('/ai-agent/generate-module-content', {
        ...request,
        ...options
      });
      
      return response.data;
    } catch (error: any) {
      console.error('Error generating enhanced module content:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate module content',
        error: error.message
      };
    }
  }

  /**
   * Generate quiz questions using AI
   */
  async generateQuizQuestions(request: QuizQuestionsRequest): Promise<AIResponse> {
    try {
      const response = await aiApiClient.post('/ai-agent/generate-quiz-questions', request);
      return response.data;
    } catch (error: any) {
      console.error('Error generating quiz questions:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate quiz questions',
        error: error.message
      };
    }
  }

  /**
   * Generate assignment using AI
   */
  async generateAssignment(request: AssignmentRequest): Promise<AIResponse> {
    try {
      const response = await aiApiClient.post('/ai-agent/generate-assignment', request);
      return response.data;
    } catch (error: any) {
      console.error('Error generating assignment:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate assignment',
        error: error.message
      };
    }
  }

  /**
   * Generate final project using AI
   */
  async generateFinalProject(request: FinalProjectRequest): Promise<AIResponse> {
    try {
      const response = await aiApiClient.post('/ai-agent/generate-final-project', request);
      return response.data;
    } catch (error: any) {
      console.error('Error generating final project:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate final project',
        error: error.message
      };
    }
  }

  /**
   * Enhance existing content using AI
   */
  async enhanceContent(request: EnhanceContentRequest): Promise<AIResponse> {
    try {
      const response = await aiApiClient.post('/ai-agent/enhance-content', request);
      return response.data;
    } catch (error: any) {
      console.error('Error enhancing content:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to enhance content',
        error: error.message
      };
    }
  }

  /**
   * Check AI agent service health
   */
  async checkHealth(): Promise<{ status: string; api_configured: boolean; message: string }> {
    try {
      const response = await apiClient.get('/ai-agent/health');
      return response.data;
    } catch (error: any) {
      console.error('Error checking AI agent health:', error);
      return {
        status: 'error',
        api_configured: false,
        message: 'Could not reach AI agent service'
      };
    }
  }

  /**
   * Generate quiz from actual lesson/module content
   */
  async generateQuizFromContent(request: QuizFromContentRequest): Promise<AIResponse> {
    try {
      const response = await aiApiClient.post('/ai-agent/generate-quiz-from-content', request);
      return response.data;
    } catch (error: any) {
      console.error('Error generating quiz from content:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate quiz from content',
        error: error.message
      };
    }
  }

  /**
   * Generate assignment from actual lesson/module content
   */
  async generateAssignmentFromContent(request: AssignmentFromContentRequest): Promise<AIResponse> {
    try {
      const response = await aiApiClient.post('/ai-agent/generate-assignment-from-content', request);
      return response.data;
    } catch (error: any) {
      console.error('Error generating assignment from content:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate assignment from content',
        error: error.message
      };
    }
  }

  /**
   * Generate project from actual module content
   */
  async generateProjectFromContent(request: ProjectFromContentRequest): Promise<AIResponse> {
    try {
      const response = await aiApiClient.post('/ai-agent/generate-project-from-content', request);
      return response.data;
    } catch (error: any) {
      console.error('Error generating project from content:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate project from content',
        error: error.message
      };
    }
  }

  /**
   * Generate mixed content lesson with template support
   */
  async generateMixedContent(request: {
    course_id: number;
    module_id: number;
    lesson_title: string;
    lesson_description?: string;
    template_id?: string;
    existing_sections?: any[];
  }): Promise<AIResponse> {
    try {
      const response = await aiApiClient.post('/ai-agent/generate-mixed-content', request);
      return response.data;
    } catch (error: any) {
      console.error('Error generating mixed content:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate mixed content',
        error: error.message
      };
    }
  }

  /**
   * Enhance a specific section of mixed content
   */
  async enhanceSectionContent(request: {
    section_type: string;
    section_content: string;
    context?: {
      lesson_title?: string;
      section_position?: string;
      previous_section?: string;
    };
  }): Promise<AIResponse> {
    try {
      const response = await aiApiClient.post('/ai-agent/enhance-section-content', request);
      return response.data;
    } catch (error: any) {
      console.error('Error enhancing section content:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to enhance section content',
        error: error.message
      };
    }
  }
}

export const aiAgentService = new AIAgentService();
export default aiAgentService;
