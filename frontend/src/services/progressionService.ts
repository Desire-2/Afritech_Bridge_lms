import { ModuleData, ModuleProgress } from './studentApi';

export interface ProgressionRequirements {
  courseContribution: number; // 10%
  quizzes: number; // 30%
  assignments: number; // 40%
  finalAssessment: number; // 20%
  passingThreshold: number; // 80%
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
  private static readonly REQUIREMENTS: ProgressionRequirements = {
    courseContribution: 10,
    quizzes: 30,
    assignments: 40,
    finalAssessment: 20,
    passingThreshold: 80
  };

  /**
   * Calculate weighted cumulative score for a module
   */
  static calculateCumulativeScore(progress: ModuleProgress): number {
    const weights = this.REQUIREMENTS;
    
    const score = (
      (progress.course_contribution_score * weights.courseContribution / 100) +
      (progress.quiz_score * weights.quizzes / 100) +
      (progress.assignment_score * weights.assignments / 100) +
      (progress.final_assessment_score * weights.finalAssessment / 100)
    );
    
    return Math.round(score * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Validate if student can proceed to next module
   */
  static validateProgression(progress: ModuleProgress): ProgressionValidation {
    const currentScore = this.calculateCumulativeScore(progress);
    const requiredScore = this.REQUIREMENTS.passingThreshold;
    const missingPoints = Math.max(0, requiredScore - currentScore);
    
    const breakdown = {
      courseContribution: {
        current: progress.course_contribution_score,
        max: 100,
        percentage: this.REQUIREMENTS.courseContribution
      },
      quizzes: {
        current: progress.quiz_score,
        max: 100,
        percentage: this.REQUIREMENTS.quizzes
      },
      assignments: {
        current: progress.assignment_score,
        max: 100,
        percentage: this.REQUIREMENTS.assignments
      },
      finalAssessment: {
        current: progress.final_assessment_score,
        max: 100,
        percentage: this.REQUIREMENTS.finalAssessment
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
      
      if (currentModule.progress.status === 'locked') {
        // Check if all previous modules are completed
        const previousModulesCompleted = sortedModules
          .slice(0, i)
          .every(mod => mod.progress.status === 'completed');
        
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
    const completedModules = modules.filter(m => m.progress.status === 'completed').length;
    const overallProgress = totalModules > 0 ? (completedModules / totalModules) * 100 : 0;
    
    const moduleScores = modules
      .filter(m => m.progress.status === 'completed')
      .map(m => this.calculateCumulativeScore(m.progress));
    
    const averageScore = moduleScores.length > 0 
      ? moduleScores.reduce((sum, score) => sum + score, 0) / moduleScores.length 
      : 0;

    const moduleBreakdown = modules.map(moduleData => ({
      moduleId: moduleData.module.id,
      title: moduleData.module.title,
      status: moduleData.progress.status,
      score: this.calculateCumulativeScore(moduleData.progress),
      attempts: moduleData.progress.attempts_count
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