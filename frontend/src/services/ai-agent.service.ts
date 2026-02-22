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
    generation_time: number | null;
    cached: boolean;
    provider_used: string | null;
    session_id?: string;
    content_quality_score?: number | null;
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

// Background task interfaces
export interface BackgroundTaskResponse {
  success: boolean;
  background: boolean;
  task_id: string;
  status: string;
  message: string;
}

export interface TaskStatus {
  task_id: string;
  task_type: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  progress: number;
  current_step: number;
  total_steps: number;
  current_step_description: string;
  steps: {
    step_number: number;
    total_steps: number;
    description: string;
    status: string;
    started_at: string | null;
    completed_at: string | null;
  }[];
  error: string | null;
}

export interface TaskProgressCallback {
  (status: TaskStatus): void;
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

  // =====================================================
  // BACKGROUND TASK MANAGEMENT
  // =====================================================

  /**
   * Submit a request to run in background mode.
   * Sends { ...requestData, background: true } and returns the task_id.
   */
  private async submitBackground(endpoint: string, requestData: any): Promise<BackgroundTaskResponse> {
    const response = await aiApiClient.post(endpoint, {
      ...requestData,
      background: true,
    });
    return response.data;
  }

  /**
   * Poll task status until completion, failure, or cancellation.
   * Calls onProgress on each poll so the UI can update step-by-step.
   * Returns the final AIResponse result.
   */
  async pollUntilComplete(
    taskId: string,
    onProgress?: TaskProgressCallback,
    pollIntervalMs: number = 3000,
  ): Promise<AIResponse> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const resp = await aiApiClient.get(`/ai-agent/task/${taskId}/status`);
          const status: TaskStatus = resp.data?.data;

          if (!status) {
            reject(new Error('Task not found'));
            return;
          }

          // Report progress
          if (onProgress) {
            onProgress(status);
          }

          if (status.status === 'completed') {
            // Fetch the full result
            try {
              const resultResp = await aiApiClient.get(`/ai-agent/task/${taskId}/result`);
              resolve(resultResp.data);
            } catch {
              resolve({ success: true, message: 'Task completed but result unavailable' });
            }
            return;
          }

          if (status.status === 'failed') {
            resolve({
              success: false,
              status: 'error',
              message: status.error || 'Task failed',
            });
            return;
          }

          if (status.status === 'cancelled') {
            resolve({
              success: false,
              status: 'error',
              message: 'Task was cancelled',
            });
            return;
          }

          // Still running — poll again
          setTimeout(poll, pollIntervalMs);
        } catch (error: any) {
          // Network error during poll — retry a couple times
          console.error('Poll error:', error);
          setTimeout(poll, pollIntervalMs * 2);
        }
      };

      poll();
    });
  }

  /**
   * Cancel a background task
   */
  async cancelTask(taskId: string): Promise<void> {
    try {
      await aiApiClient.post(`/ai-agent/task/${taskId}/cancel`);
    } catch (error) {
      console.error('Cancel task failed:', error);
    }
  }

  /**
   * Get all active tasks for the current user
   */
  async getActiveTasks(): Promise<TaskStatus[]> {
    try {
      const response = await aiApiClient.get('/ai-agent/task/active');
      return response.data?.data || [];
    } catch {
      return [];
    }
  }

  /**
   * Run a generation request in background mode with polling.
   * This is the core method — all generation methods delegate to it.
   * 
   * 1. POSTs to the endpoint with background: true → gets task_id
   * 2. Polls /task/{id}/status every 3s
   * 3. Calls onProgress with step-by-step updates
   * 4. Returns the final AIResponse when done
   */
  private async runInBackground(
    endpoint: string,
    requestData: any,
    onProgress?: TaskProgressCallback,
  ): Promise<AIResponse & { task_id?: string }> {
    try {
      // Step 1: Submit as background task
      const taskResponse = await this.submitBackground(endpoint, requestData);

      if (!taskResponse.task_id) {
        // Server didn't return a task_id — fall through (shouldn't happen)
        throw new Error('No task_id returned from server');
      }

      // Step 2: Poll until complete
      const result = await this.pollUntilComplete(
        taskResponse.task_id,
        onProgress,
      );

      return { ...result, task_id: taskResponse.task_id };
    } catch (error: any) {
      console.error(`Background generation failed for ${endpoint}:`, error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Background generation failed',
        error: error.message,
      };
    }
  }

  // =====================================================
  // GENERATION METHODS (all use background mode)
  // =====================================================

  /**
   * Generate course outline using AI (background)
   */
  async generateCourseOutline(
    request: CourseOutlineRequest,
    onProgress?: TaskProgressCallback,
  ): Promise<AIResponse> {
    return this.runInBackground('/ai-agent/generate-course-outline', request, onProgress);
  }

  /**
   * Generate module content using AI (background)
   */
  async generateModuleContent(
    request: ModuleContentRequest,
    onProgress?: TaskProgressCallback,
  ): Promise<AIResponse> {
    return this.runInBackground('/ai-agent/generate-module-content', request, onProgress);
  }

  /**
   * Generate multiple modules at once using AI (background, step-by-step)
   */
  async generateMultipleModules(
    request: MultipleModulesRequest,
    onProgress?: TaskProgressCallback,
  ): Promise<AIResponse> {
    return this.runInBackground('/ai-agent/generate-multiple-modules', request, onProgress);
  }

  /**
   * Generate multiple lessons at once using AI (background, step-by-step)
   */
  async generateMultipleLessons(
    request: MultipleLessonsRequest,
    onProgress?: TaskProgressCallback,
  ): Promise<AIResponse> {
    return this.runInBackground('/ai-agent/generate-multiple-lessons', request, onProgress);
  }

  /**
   * Generate lesson content (background)
   */
  async generateLessonContent(
    request: LessonContentRequest,
    onProgress?: TaskProgressCallback,
  ): Promise<AIResponse> {
    return this.runInBackground('/ai-agent/generate-lesson-content', request, onProgress);
  }
  /**
   * Generate module content with enhanced features (background)
   */
  async generateModuleContentEnhanced(
    request: ModuleContentRequest,
    options?: {
      trackProgress?: boolean;
      qualityThreshold?: number;
    },
    onProgress?: TaskProgressCallback,
  ): Promise<AIResponse> {
    return this.runInBackground('/ai-agent/generate-module-content', {
      ...request,
      ...options,
    }, onProgress);
  }

  /**
   * Generate quiz questions using AI (background)
   */
  async generateQuizQuestions(
    request: QuizQuestionsRequest,
    onProgress?: TaskProgressCallback,
  ): Promise<AIResponse> {
    return this.runInBackground('/ai-agent/generate-quiz-questions', request, onProgress);
  }

  /**
   * Generate assignment using AI (background)
   */
  async generateAssignment(
    request: AssignmentRequest,
    onProgress?: TaskProgressCallback,
  ): Promise<AIResponse> {
    return this.runInBackground('/ai-agent/generate-assignment', request, onProgress);
  }

  /**
   * Generate final project using AI (background)
   */
  async generateFinalProject(
    request: FinalProjectRequest,
    onProgress?: TaskProgressCallback,
  ): Promise<AIResponse> {
    return this.runInBackground('/ai-agent/generate-final-project', request, onProgress);
  }

  /**
   * Enhance existing content using AI (synchronous — typically fast)
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
   * Generate quiz from actual lesson/module content (synchronous — typically fast)
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
   * Generate assignment from actual lesson/module content (synchronous)
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
   * Generate project from actual module content (synchronous)
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
   * Generate mixed content lesson with template support (synchronous)
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
   * Enhance a specific section of mixed content (synchronous)
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