import { axiosInstance } from './api/base.service';

export interface ModuleUnlockEligibility {
  eligible: boolean;
  can_preview: boolean;
  current_status: string;
  total_score: number;
  required_score: number;
  prerequisites: {
    all_completed: boolean;
    completed_count: number;
    total_count: number;
    failed_modules: Array<{
      id: number;
      title: string;
      score?: number;
      status?: string;
      required: string | number;
    }>;
  };
  lesson_requirements: {
    all_lessons_passed: boolean;
    passed_count: number;
    total_count: number;
    failed_lessons: Array<{
      id: number;
      title: string;
      score?: number;
      status?: string;
      requirements?: string[];
    }>;
  };
  scoring_breakdown: {
    total_score: number;
    breakdown: {
      lessons_average: number;
      quiz_score: number;
      assignment_score: number;
      final_assessment: number;
    };
    weights_used: any;
    raw_cumulative: number;
  };
  recommendations: string[];
  unlock_timestamp: string;
  next_module_info?: {
    id: number;
    title: string;
    order: number;
    lesson_count: number;
  };
}

export interface ModuleUnlockResult {
  success: boolean;
  message?: string;
  error?: string;
  details?: any;
  current_module?: {
    id: number;
    title: string;
    completed_score: number;
  };
  next_module?: {
    id: number;
    title: string;
    order: number;
  };
  celebration_data?: {
    achievement_unlocked: string;
    score_achieved: number;
    next_challenge: string;
  };
  course_completed?: boolean;
  unlock_type?: string;
}

export interface CourseUnlockProgress {
  course_id: number;
  course_title: string;
  total_modules: number;
  modules_completed: number;
  modules_unlocked: number;
  current_module_id: number | null;
  next_unlockable_module: {
    id: number;
    title: string;
    order: number;
    status: string;
    score: number;
    eligibility: ModuleUnlockEligibility;
  } | null;
  overall_progress: number;
  modules: Array<{
    id: number;
    title: string;
    order: number;
    status: string;
    score: number;
    eligibility: ModuleUnlockEligibility;
    unlocked_at: string | null;
    completed_at: string | null;
  }>;
}

export interface UnlockNotification {
  type: string;
  student_id: number;
  module_id: number;
  module_title: string;
  timestamp: string;
  message: string;
  current_progress?: number;
  required_progress?: number;
  recommendations?: string[];
  celebration_type?: string;
  next_steps?: string[];
  reminder_type?: string;
  action_url?: string;
}

/**
 * Enhanced Module Unlock API Service
 * Provides comprehensive module unlock functionality with detailed validation,
 * progress tracking, and user experience enhancements.
 */
export class EnhancedModuleUnlockService {
  
  /**
   * Check comprehensive module unlock eligibility
   */
  static async checkModuleUnlockEligibility(moduleId: number): Promise<ModuleUnlockEligibility> {
    try {
      const response = await axiosInstance.get(`/learning/module/${moduleId}/unlock-eligibility`);
      
      if (response.data.success) {
        return response.data.eligibility;
      } else {
        throw new Error(response.data.error || 'Failed to check unlock eligibility');
      }
    } catch (error: any) {
      console.error('Module unlock eligibility check failed:', error);
      throw new Error(error.response?.data?.error || 'Network error checking unlock eligibility');
    }
  }

  /**
   * Attempt enhanced module unlock with comprehensive validation
   */
  static async attemptModuleUnlock(moduleId: number): Promise<ModuleUnlockResult> {
    try {
      const response = await axiosInstance.post(`/learning/module/${moduleId}/unlock`);
      
      if (response.data.success) {
        return response.data.result;
      } else {
        return {
          success: false,
          error: response.data.error || 'Module unlock failed',
          details: response.data.details
        };
      }
    } catch (error: any) {
      console.error('Module unlock attempt failed:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Network error during module unlock'
      };
    }
  }

  /**
   * Get comprehensive course unlock progress
   */
  static async getCourseUnlockProgress(courseId: number): Promise<CourseUnlockProgress> {
    try {
      const response = await axiosInstance.get(`/learning/course/${courseId}/unlock-progress`);
      
      if (response.data.success) {
        return response.data.progress;
      } else {
        throw new Error(response.data.error || 'Failed to get unlock progress');
      }
    } catch (error: any) {
      console.error('Course unlock progress fetch failed:', error);
      throw new Error(error.response?.data?.error || 'Network error fetching unlock progress');
    }
  }

  /**
   * Handle unlock notification
   */
  static async handleUnlockNotification(
    moduleId: number, 
    notificationType: 'pre_unlock_warning' | 'unlock_celebration' | 'unlock_reminder'
  ): Promise<UnlockNotification> {
    try {
      const response = await axiosInstance.post(`/learning/module/${moduleId}/unlock-notification`, {
        notification_type: notificationType
      });
      
      if (response.data.success) {
        return response.data.notification;
      } else {
        throw new Error(response.data.error || 'Failed to handle unlock notification');
      }
    } catch (error: any) {
      console.error('Unlock notification handling failed:', error);
      throw new Error(error.response?.data?.error || 'Network error handling notification');
    }
  }

  /**
   * Check if student is close to unlocking next module (85%+ progress)
   */
  static async checkPreUnlockWarning(moduleId: number): Promise<boolean> {
    try {
      const eligibility = await this.checkModuleUnlockEligibility(moduleId);
      return eligibility.total_score >= 85.0 && eligibility.total_score < eligibility.required_score;
    } catch (error) {
      console.warn('Pre-unlock warning check failed:', error);
      return false;
    }
  }

  /**
   * Get next module that can be unlocked
   */
  static async getNextUnlockableModule(courseId: number): Promise<any | null> {
    try {
      const progress = await this.getCourseUnlockProgress(courseId);
      return progress.next_unlockable_module;
    } catch (error) {
      console.warn('Next unlockable module check failed:', error);
      return null;
    }
  }

  /**
   * Calculate unlock progress percentage for a module
   */
  static calculateUnlockProgress(eligibility: ModuleUnlockEligibility): {
    percentage: number;
    breakdown: {
      prerequisites: number;
      lessons: number;
      score: number;
      overall: number;
    };
  } {
    const prerequisites = eligibility.prerequisites.all_completed ? 100 : 
      (eligibility.prerequisites.completed_count / eligibility.prerequisites.total_count) * 100;
    
    const lessons = eligibility.lesson_requirements.all_lessons_passed ? 100 : 
      (eligibility.lesson_requirements.passed_count / eligibility.lesson_requirements.total_count) * 100;
    
    const score = Math.min((eligibility.total_score / eligibility.required_score) * 100, 100);
    
    const overall = (prerequisites + lessons + score) / 3;
    
    return {
      percentage: overall,
      breakdown: {
        prerequisites,
        lessons,
        score,
        overall
      }
    };
  }

  /**
   * Format unlock recommendations for display
   */
  static formatRecommendations(recommendations: string[]): Array<{
    text: string;
    priority: 'high' | 'medium' | 'low';
    actionable: boolean;
  }> {
    return recommendations.map((rec, index) => {
      let priority: 'high' | 'medium' | 'low' = 'medium';
      let actionable = true;

      // High priority items
      if (rec.includes('Complete') && rec.includes('prerequisite')) {
        priority = 'high';
      } else if (rec.includes('increase') && rec.includes('score')) {
        priority = 'high';
      }
      
      // Low priority items
      else if (rec.includes('ready to unlock')) {
        priority = 'low';
        actionable = false;
      }

      return {
        text: rec,
        priority,
        actionable
      };
    });
  }

  /**
   * Validate unlock readiness with detailed status
   */
  static validateUnlockReadiness(eligibility: ModuleUnlockEligibility): {
    ready: boolean;
    blockers: string[];
    warnings: string[];
    nextSteps: string[];
  } {
    const blockers: string[] = [];
    const warnings: string[] = [];
    const nextSteps: string[] = [];

    // Check prerequisites
    if (!eligibility.prerequisites.all_completed) {
      blockers.push(`${eligibility.prerequisites.failed_modules.length} prerequisite module(s) not completed`);
      nextSteps.push('Complete all prerequisite modules');
    }

    // Check lessons
    if (!eligibility.lesson_requirements.all_lessons_passed) {
      blockers.push(`${eligibility.lesson_requirements.failed_lessons.length} lesson(s) not meeting requirements`);
      nextSteps.push('Complete all lesson requirements');
    }

    // Check score
    if (eligibility.total_score < eligibility.required_score) {
      const gap = eligibility.required_score - eligibility.total_score;
      blockers.push(`Score ${gap.toFixed(1)}% points below requirement`);
      nextSteps.push(`Increase overall score by ${gap.toFixed(1)}%`);
    }

    // Warnings for close-to-ready scenarios
    if (eligibility.total_score >= eligibility.required_score * 0.9) {
      warnings.push('Very close to unlock! Keep going.');
    }

    if (eligibility.can_preview) {
      warnings.push('Module preview available - you can explore content');
    }

    return {
      ready: eligibility.eligible,
      blockers,
      warnings,
      nextSteps
    };
  }

  /**
   * Get unlock celebration data
   */
  static getCelebrationData(unlockResult: ModuleUnlockResult): {
    shouldCelebrate: boolean;
    celebrationType: 'module_unlock' | 'course_completion' | 'achievement';
    celebrationMessage: string;
    celebrationSubtext: string;
    nextAction: string;
  } {
    if (!unlockResult.success) {
      return {
        shouldCelebrate: false,
        celebrationType: 'module_unlock',
        celebrationMessage: '',
        celebrationSubtext: '',
        nextAction: ''
      };
    }

    if (unlockResult.course_completed) {
      return {
        shouldCelebrate: true,
        celebrationType: 'course_completion',
        celebrationMessage: '🎓 Congratulations! Course Completed!',
        celebrationSubtext: 'You have successfully completed all modules',
        nextAction: 'View Certificate'
      };
    }

    if (unlockResult.next_module) {
      return {
        shouldCelebrate: true,
        celebrationType: 'module_unlock',
        celebrationMessage: `🎉 ${unlockResult.current_module?.title} Completed!`,
        celebrationSubtext: `Next: ${unlockResult.next_module.title}`,
        nextAction: 'Continue Learning'
      };
    }

    return {
      shouldCelebrate: true,
      celebrationType: 'achievement',
      celebrationMessage: '✨ Great Progress!',
      celebrationSubtext: unlockResult.message || 'Keep up the excellent work',
      nextAction: 'Continue'
    };
  }
}

export default EnhancedModuleUnlockService;