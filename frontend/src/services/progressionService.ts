import { ModuleData, ModuleProgress } from './studentApi';

export interface ProgressionRequirements {
  courseContribution: number; // Default 10% (varies based on available assessments)
  quizzes: number; // Default 30% (varies based on available assessments)
  assignments: number; // Default 40% (varies based on available assessments)
  finalAssessment: number; // Default 20% (varies based on available assessments)
  passingThreshold: number; // 80%
}

export interface DynamicWeights {
  courseContribution: number;
  quizzes: number;
  assignments: number;
  finalAssessment: number;
}

export interface AssessmentAvailability {
  hasQuizzes: boolean;
  hasAssignments: boolean;
  hasFinalAssessment: boolean;
  isReadingOnly: boolean;
}

export interface ProgressionValidation {
  canProceed: boolean;
  currentScore: number;
  requiredScore: number;
  missingPoints: number;
  breakdown: {
    courseContribution: { current: number; max: number; percentage: number };
    quizzes: { current: number; max: number; percentage: number };
    assignments: { current: number; max: number; percentage: number };
    finalAssessment: { current: number; max: number; percentage: number };
  };
  warnings: string[];
  recommendations: string[];
}

export interface RetakeEligibility {
  canRetake: boolean;
  attemptsUsed: number;
  maxAttempts: number;
  remainingAttempts: number;
  isLastAttempt: boolean;
  reason?: string;
}

export interface SuspensionRisk {
  isAtRisk: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
  recommendedActions: string[];
}

export class ProgressionService {
  private static readonly DEFAULT_REQUIREMENTS: ProgressionRequirements = {
    courseContribution: 10,
    quizzes: 30,
    assignments: 40,
    finalAssessment: 20,
    passingThreshold: 80
  };

  // Alias for backwards compatibility
  private static readonly REQUIREMENTS = ProgressionService.DEFAULT_REQUIREMENTS;

  /**
   * Calculate dynamic weights based on available assessments in the module
   * This matches the backend logic in student_models.py calculate_module_weighted_score()
   */
  static calculateDynamicWeights(assessmentAvailability: AssessmentAvailability): DynamicWeights {
    const { hasQuizzes, hasAssignments, hasFinalAssessment } = assessmentAvailability;

    // Match backend logic exactly
    if (!hasQuizzes && !hasAssignments && !hasFinalAssessment) {
      // No assessments - Reading & Engagement is 100%
      return { courseContribution: 100, quizzes: 0, assignments: 0, finalAssessment: 0 };
    } else if (!hasQuizzes && !hasAssignments) {
      // Only final assessment exists
      return { courseContribution: 40, quizzes: 0, assignments: 0, finalAssessment: 60 };
    } else if (!hasQuizzes && !hasFinalAssessment) {
      // Only assignments exist
      return { courseContribution: 30, quizzes: 0, assignments: 70, finalAssessment: 0 };
    } else if (!hasAssignments && !hasFinalAssessment) {
      // Only quizzes exist
      return { courseContribution: 30, quizzes: 70, assignments: 0, finalAssessment: 0 };
    } else if (!hasQuizzes) {
      // Assignments and final exist, no quizzes
      return { courseContribution: 15, quizzes: 0, assignments: 55, finalAssessment: 30 };
    } else if (!hasAssignments) {
      // Quizzes and final exist, no assignments
      return { courseContribution: 15, quizzes: 55, assignments: 0, finalAssessment: 30 };
    } else if (!hasFinalAssessment) {
      // Quizzes and assignments exist, no final
      return { courseContribution: 15, quizzes: 40, assignments: 45, finalAssessment: 0 };
    } else {
      // All components exist - use default weights
      return {
        courseContribution: 10,
        quizzes: 30,
        assignments: 40,
        finalAssessment: 20
      };
    }
  }

  /**
   * Calculate weighted cumulative score for a module
   * Prefers backend-calculated weighted_score if available (which uses dynamic weights)
   * Falls back to client-side calculation with default weights for backwards compatibility
   */
  static calculateCumulativeScore(progress: ModuleProgress, dynamicWeights?: DynamicWeights): number {
    if (!progress) {
      return 0;
    }
    
    // Prefer backend-calculated weighted_score if available (uses dynamic weights)
    if (progress.weighted_score !== undefined && progress.weighted_score !== null) {
      return Math.round(progress.weighted_score * 100) / 100;
    }
    
    // Also accept cumulative_score from backend
    if (progress.cumulative_score !== undefined && progress.cumulative_score !== null) {
      return Math.round(progress.cumulative_score * 100) / 100;
    }
    
    // Fallback: Calculate with provided dynamic weights or defaults
    const weights = dynamicWeights || this.DEFAULT_REQUIREMENTS;
    
    const score = (
      ((progress.course_contribution_score || 0) * weights.courseContribution / 100) +
      ((progress.quiz_score || 0) * weights.quizzes / 100) +
      ((progress.assignment_score || 0) * weights.assignments / 100) +
      ((progress.final_assessment_score || 0) * weights.finalAssessment / 100)
    );
    
    return Math.round(score * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Validate if student can proceed to next module
   * Now supports dynamic weights based on available assessments
   */
  static validateProgression(progress: ModuleProgress, assessmentAvailability?: AssessmentAvailability): ProgressionValidation {
    // Use dynamic weights if assessment availability is provided
    const weights = assessmentAvailability 
      ? this.calculateDynamicWeights(assessmentAvailability)
      : this.DEFAULT_REQUIREMENTS;
    
    const currentScore = this.calculateCumulativeScore(progress, weights);
    const requiredScore = this.DEFAULT_REQUIREMENTS.passingThreshold;
    const missingPoints = Math.max(0, requiredScore - currentScore);
    
    const breakdown = {
      courseContribution: {
        current: progress?.course_contribution_score || 0,
        max: 100,
        percentage: weights.courseContribution
      },
      quizzes: {
        current: progress?.quiz_score || 0,
        max: 100,
        percentage: weights.quizzes
      },
      assignments: {
        current: progress?.assignment_score || 0,
        max: 100,
        percentage: weights.assignments
      },
      finalAssessment: {
        current: progress?.final_assessment_score || 0,
        max: 100,
        percentage: weights.finalAssessment
      }
    };

    const warnings = this.generateWarnings(progress, currentScore);
    const recommendations = this.generateRecommendations(progress, breakdown);

    return {
      canProceed: currentScore >= requiredScore,
      currentScore,
      requiredScore,
      missingPoints,
      breakdown,
      warnings,
      recommendations
    };
  }

  /**
   * Check retake eligibility for a module
   */
  static checkRetakeEligibility(progress: ModuleProgress): RetakeEligibility {
    if (!progress) {
      return {
        canRetake: false,
        attemptsUsed: 0,
        maxAttempts: 3,
        remainingAttempts: 3,
        isLastAttempt: false,
        reason: 'Module progress not initialized'
      };
    }
    
    const canRetake = progress.attempts_count < progress.max_attempts && progress.status === 'failed';
    const remainingAttempts = Math.max(0, progress.max_attempts - progress.attempts_count);
    const isLastAttempt = progress.attempts_count === progress.max_attempts - 1;

    let reason: string | undefined;
    if (!canRetake) {
      if (progress.status !== 'failed') {
        reason = 'Module not in failed status';
      } else if (progress.attempts_count >= progress.max_attempts) {
        reason = 'Maximum attempts exceeded';
      }
    }

    return {
      canRetake,
      attemptsUsed: progress.attempts_count,
      maxAttempts: progress.max_attempts,
      remainingAttempts,
      isLastAttempt,
      reason
    };
  }

  /**
   * Assess suspension risk based on module progress
   */
  static assessSuspensionRisk(moduleData: ModuleData): SuspensionRisk {
    const { progress } = moduleData;
    
    // Handle missing progress data
    if (!progress) {
      return {
        isAtRisk: false,
        riskLevel: 'low',
        reasons: ['Module progress not initialized'],
        recommendedActions: ['Start the module to track progress']
      };
    }
    
    const currentScore = this.calculateCumulativeScore(progress);
    const retakeEligibility = this.checkRetakeEligibility(progress);
    
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const reasons: string[] = [];
    const recommendedActions: string[] = [];

    // Critical risk - final attempt or already failed with no retakes
    if (!retakeEligibility.canRetake && progress.status === 'failed') {
      riskLevel = 'critical';
      reasons.push('Maximum attempts reached');
      recommendedActions.push('Submit an appeal if you believe the assessment was unfair');
    } else if (retakeEligibility.isLastAttempt) {
      riskLevel = 'critical';
      reasons.push('This is your final attempt');
      recommendedActions.push('Review all course materials thoroughly');
      recommendedActions.push('Complete practice exercises');
      recommendedActions.push('Seek help from instructors or peers');
    }
    // High risk - low score with few attempts left
    else if (currentScore < 60 && retakeEligibility.remainingAttempts <= 1) {
      riskLevel = 'high';
      reasons.push('Low cumulative score with limited attempts remaining');
      recommendedActions.push('Focus on high-weight assessments (assignments and final assessment)');
      recommendedActions.push('Improve assignment quality');
    }
    // Medium risk - borderline score or multiple failed attempts
    else if (currentScore < 70 || progress.attempts_count > 1) {
      riskLevel = 'medium';
      reasons.push('Below optimal performance level');
      recommendedActions.push('Review weak areas identified in feedback');
      recommendedActions.push('Complete additional practice exercises');
    }
    // Low risk - good progress
    else if (currentScore >= 70) {
      riskLevel = 'low';
      recommendedActions.push('Continue current study approach');
      recommendedActions.push('Focus on maintaining quality in remaining assessments');
    }

    const isAtRisk = riskLevel !== 'low';

    return {
      isAtRisk,
      riskLevel,
      reasons,
      recommendedActions
    };
  }

  /**
   * Get next module in sequence that should be unlocked
   */
  static getNextUnlockableModule(modules: ModuleData[]): ModuleData | null {
    // Sort modules by order
    const sortedModules = [...modules].sort((a, b) => a.module.order - b.module.order);
    
    // Find the first locked module where all previous modules are completed
    for (let i = 0; i < sortedModules.length; i++) {
      const currentModule = sortedModules[i];
      
      if (currentModule.progress?.status === 'locked') {
        // Check if all previous modules are completed
        const previousModulesCompleted = sortedModules
          .slice(0, i)
          .every(mod => mod.progress?.status === 'completed');
        
        if (previousModulesCompleted) {
          return currentModule;
        }
      }
    }
    
    return null;
  }

  /**
   * Calculate overall course progress based on module completion
   */
  static calculateCourseProgress(modules: ModuleData[]): {
    overallProgress: number;
    completedModules: number;
    totalModules: number;
    averageScore: number;
    moduleBreakdown: Array<{
      moduleId: number;
      title: string;
      status: string;
      score: number;
      attempts: number;
    }>;
  } {
    const totalModules = modules.length;
    const completedModules = modules.filter(m => m.progress?.status === 'completed').length;
    const overallProgress = totalModules > 0 ? (completedModules / totalModules) * 100 : 0;
    
    const moduleScores = modules
      .filter(m => m.progress?.status === 'completed')
      .map(m => this.calculateCumulativeScore(m.progress));
    
    const averageScore = moduleScores.length > 0 
      ? moduleScores.reduce((sum, score) => sum + score, 0) / moduleScores.length 
      : 0;

    const moduleBreakdown = modules.map(moduleData => ({
      moduleId: moduleData.module.id,
      title: moduleData.module.title,
      status: moduleData.progress?.status || 'locked',
      score: moduleData.progress ? this.calculateCumulativeScore(moduleData.progress) : 0,
      attempts: moduleData.progress?.attempts_count || 0
    }));

    return {
      overallProgress,
      completedModules,
      totalModules,
      averageScore,
      moduleBreakdown
    };
  }

  /**
   * Generate warnings based on current progress
   */
  private static generateWarnings(progress: ModuleProgress, currentScore: number): string[] {
    const warnings: string[] = [];
    
    if (currentScore < 50) {
      warnings.push('Current score is significantly below passing threshold');
    } else if (currentScore < 70) {
      warnings.push('Current score is below optimal level');
    }
    
    if (progress.attempts_count >= progress.max_attempts - 1) {
      warnings.push('This is your final attempt - failure will result in course suspension');
    } else if (progress.attempts_count >= progress.max_attempts - 2) {
      warnings.push('You have limited attempts remaining');
    }
    
    if (progress.quiz_score < 60) {
      warnings.push('Quiz performance is below expectations');
    }
    
    if (progress.assignment_score < 60) {
      warnings.push('Assignment quality needs improvement');
    }
    
    return warnings;
  }

  /**
   * Generate recommendations based on progress breakdown
   */
  private static generateRecommendations(
    progress: ModuleProgress, 
    breakdown: ProgressionValidation['breakdown']
  ): string[] {
    const recommendations: string[] = [];
    
    // Prioritize high-weight areas
    if (breakdown.assignments.current < 70) {
      recommendations.push('Focus on improving assignment quality (40% of total grade)');
    }
    
    if (breakdown.quizzes.current < 70) {
      recommendations.push('Review quiz material and retake if possible (30% of total grade)');
    }
    
    if (breakdown.finalAssessment.current < 70) {
      recommendations.push('Prepare thoroughly for final assessment (20% of total grade)');
    }
    
    if (breakdown.courseContribution.current < 70) {
      recommendations.push('Increase course participation and complete all lessons');
    }
    
    // General recommendations
    if (progress.attempts_count > 0) {
      recommendations.push('Review feedback from previous attempts');
    }
    
    recommendations.push('Utilize available resources: forums, instructor office hours, study groups');
    
    return recommendations;
  }

  /**
   * Format score for display
   */
  static formatScore(score: number, decimals: number = 1): string {
    return score.toFixed(decimals) + '%';
  }

  /**
   * Get status color class for UI
   */
  static getStatusColorClass(status: string): string {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'in_progress':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'unlocked':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'locked':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  }

  /**
   * Get risk level color class for UI
   */
  static getRiskColorClass(riskLevel: SuspensionRisk['riskLevel']): string {
    switch (riskLevel) {
      case 'critical':
        return 'text-red-800 bg-red-100 border-red-300';
      case 'high':
        return 'text-orange-800 bg-orange-100 border-orange-300';
      case 'medium':
        return 'text-yellow-800 bg-yellow-100 border-yellow-300';
      case 'low':
        return 'text-green-800 bg-green-100 border-green-300';
      default:
        return 'text-gray-800 bg-gray-100 border-gray-300';
    }
  }
}

export default ProgressionService;