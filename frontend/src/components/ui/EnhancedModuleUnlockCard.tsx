import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Unlock, 
  Lock, 
  CheckCircle, 
  AlertCircle, 
  Star, 
  Trophy,
  Eye,
  ArrowRight,
  Loader2,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EnhancedModuleUnlockService, ModuleUnlockEligibility, ModuleUnlockResult } from '@/services/enhancedModuleUnlockService';

interface EnhancedModuleUnlockCardProps {
  moduleId: number;
  moduleTitle: string;
  moduleOrder: number;
  currentModuleId?: number;
  isLastLessonInCurrentModule: boolean;
  onUnlockSuccess: (result: ModuleUnlockResult) => void;
  onPreviewModule?: (moduleId: number) => void;
  className?: string;
}

export const EnhancedModuleUnlockCard: React.FC<EnhancedModuleUnlockCardProps> = ({
  moduleId,
  moduleTitle,
  moduleOrder,
  currentModuleId,
  isLastLessonInCurrentModule,
  onUnlockSuccess,
  onPreviewModule,
  className
}) => {
  const [eligibility, setEligibility] = useState<ModuleUnlockEligibility | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Load eligibility on mount and when relevant props change
  useEffect(() => {
    if (isLastLessonInCurrentModule && currentModuleId) {
      loadEligibility();
    }
  }, [moduleId, isLastLessonInCurrentModule, currentModuleId]);

  const loadEligibility = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await EnhancedModuleUnlockService.checkModuleUnlockEligibility(moduleId);
      setEligibility(result);
    } catch (err: any) {
      setError(err.message || 'Failed to check unlock eligibility');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!eligibility?.eligible) return;
    
    setIsUnlocking(true);
    
    try {
      const result = await EnhancedModuleUnlockService.attemptModuleUnlock(currentModuleId!);
      
      if (result.success) {
        await onUnlockSuccess(result);
        // Reload eligibility for next module
        await loadEligibility();
      } else {
        setError(result.error || 'Failed to unlock module');
      }
    } catch (err: any) {
      setError(err.message || 'Network error during unlock');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handlePreview = () => {
    if (onPreviewModule && eligibility?.can_preview) {
      onPreviewModule(moduleId);
    }
  };

  if (!isLastLessonInCurrentModule) {
    return null; // Don't show if not at the last lesson
  }

  if (isLoading) {
    return (
      <Card className={cn(\"border-blue-200 bg-blue-50\", className)}>
        <CardContent className=\"p-4\">
          <div className=\"flex items-center justify-center space-x-2\">
            <Loader2 className=\"h-5 w-5 animate-spin text-blue-600\" />
            <span className=\"text-sm text-blue-700\">Checking unlock status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert className={cn(\"border-red-200 bg-red-50\", className)}>
        <AlertCircle className=\"h-4 w-4\" />
        <AlertDescription>
          {error}
          <Button 
            variant=\"ghost\" 
            size=\"sm\" 
            onClick={loadEligibility}
            className=\"ml-2 h-auto p-1 text-red-700 hover:bg-red-100\"
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!eligibility) {
    return null;
  }

  const progress = EnhancedModuleUnlockService.calculateUnlockProgress(eligibility);
  const validation = EnhancedModuleUnlockService.validateUnlockReadiness(eligibility);
  const recommendations = EnhancedModuleUnlockService.formatRecommendations(eligibility.recommendations);

  return (
    <Card className={cn(
      \"border-2 transition-all duration-300\",
      eligibility.eligible 
        ? \"border-green-300 bg-green-50 shadow-green-100\" 
        : eligibility.can_preview 
        ? \"border-blue-300 bg-blue-50 shadow-blue-100\"
        : \"border-orange-300 bg-orange-50 shadow-orange-100\",
      className
    )}>
      <CardHeader className=\"pb-3\">
        <div className=\"flex items-center justify-between\">
          <div className=\"flex items-center space-x-3\">
            {eligibility.eligible ? (
              <CheckCircle className=\"h-6 w-6 text-green-600\" />
            ) : eligibility.can_preview ? (
              <Eye className=\"h-6 w-6 text-blue-600\" />
            ) : (
              <Lock className=\"h-6 w-6 text-orange-600\" />
            )}
            <div>
              <CardTitle className=\"text-lg font-bold text-gray-900\">
                Module {moduleOrder}: {moduleTitle}
              </CardTitle>
              <CardDescription className=\"text-sm\">
                {eligibility.eligible 
                  ? \"Ready to unlock!\" 
                  : eligibility.can_preview 
                  ? \"Preview available\" 
                  : \"Requirements not met\"}
              </CardDescription>
            </div>
          </div>
          <Badge 
            variant={eligibility.eligible ? \"default\" : \"secondary\"}
            className={eligibility.eligible ? \"bg-green-100 text-green-800\" : \"\"}
          >
            {eligibility.total_score.toFixed(1)}% / {eligibility.required_score}%
          </Badge>
        </div>
      </CardHeader>

      <CardContent className=\"space-y-4\">
        {/* Progress Bar */}
        <div className=\"space-y-2\">
          <div className=\"flex justify-between text-sm\">
            <span className=\"font-medium text-gray-700\">Overall Progress</span>
            <span className={cn(
              \"font-bold\",
              progress.percentage >= 100 ? \"text-green-600\" : \"text-gray-600\"
            )}>
              {progress.percentage.toFixed(1)}%
            </span>
          </div>
          <Progress 
            value={progress.percentage} 
            className={cn(
              \"h-2\",
              progress.percentage >= 100 ? \"bg-green-100\" : \"bg-gray-200\"
            )}
          />
        </div>

        {/* Status Messages */}
        {validation.ready ? (
          <Alert className=\"border-green-200 bg-green-50\">
            <Sparkles className=\"h-4 w-4\" />
            <AlertDescription className=\"text-green-800\">
              <strong>Excellent!</strong> All requirements met. Ready to unlock the next module!
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className=\"border-orange-200 bg-orange-50\">
            <AlertCircle className=\"h-4 w-4\" />
            <AlertDescription className=\"text-orange-800\">
              <strong>Almost there!</strong> {validation.blockers.length} requirement(s) remaining.
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className=\"flex flex-col space-y-2\">
          {eligibility.eligible && (
            <Button
              onClick={handleUnlock}
              disabled={isUnlocking}
              className=\"w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 shadow-lg\"
              size=\"lg\"
            >
              {isUnlocking ? (
                <>
                  <Loader2 className=\"mr-2 h-5 w-5 animate-spin\" />
                  Unlocking...
                </>
              ) : (
                <>
                  <Unlock className=\"mr-2 h-5 w-5\" />
                  Unlock {moduleTitle}
                </>
              )}
            </Button>
          )}

          {eligibility.can_preview && onPreviewModule && (
            <Button
              variant=\"outline\"
              onClick={handlePreview}
              className=\"w-full border-blue-300 text-blue-700 hover:bg-blue-50\"
            >
              <Eye className=\"mr-2 h-4 w-4\" />
              Preview Module Content
            </Button>
          )}

          <Button
            variant=\"ghost\"
            onClick={() => setShowDetails(!showDetails)}
            className=\"w-full text-gray-600 hover:text-gray-800\"
          >
            {showDetails ? 'Hide Details' : 'Show Requirements'}
            <ArrowRight className={cn(
              \"ml-2 h-4 w-4 transition-transform\",
              showDetails && \"rotate-90\"
            )} />
          </Button>
        </div>

        {/* Detailed Requirements (Expandable) */}
        {showDetails && (
          <div className=\"space-y-3 pt-2 border-t border-gray-200\">
            {/* Prerequisites */}
            <div className=\"space-y-2\">
              <div className=\"flex items-center justify-between\">
                <span className=\"font-medium text-gray-700\">Prerequisites</span>
                <Badge variant={eligibility.prerequisites.all_completed ? \"default\" : \"destructive\"}>
                  {eligibility.prerequisites.completed_count}/{eligibility.prerequisites.total_count}
                </Badge>
              </div>
              {eligibility.prerequisites.failed_modules.length > 0 && (
                <div className=\"text-sm text-gray-600\">
                  <p className=\"mb-1\">Missing prerequisites:</p>
                  <ul className=\"list-disc list-inside space-y-1\">
                    {eligibility.prerequisites.failed_modules.map((module, idx) => (
                      <li key={idx} className=\"text-orange-700\">
                        {module.title} {typeof module.required === 'number' 
                          ? `(${module.score?.toFixed(1)}% / ${module.required}%)` 
                          : `(${module.status})`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Lesson Requirements */}
            <div className=\"space-y-2\">
              <div className=\"flex items-center justify-between\">
                <span className=\"font-medium text-gray-700\">Lesson Requirements</span>
                <Badge variant={eligibility.lesson_requirements.all_lessons_passed ? \"default\" : \"destructive\"}>
                  {eligibility.lesson_requirements.passed_count}/{eligibility.lesson_requirements.total_count}
                </Badge>
              </div>
              {eligibility.lesson_requirements.failed_lessons.length > 0 && (
                <div className=\"text-sm text-gray-600\">
                  <p className=\"mb-1\">Lessons needing attention:</p>
                  <ul className=\"list-disc list-inside space-y-1\">
                    {eligibility.lesson_requirements.failed_lessons.slice(0, 3).map((lesson, idx) => (
                      <li key={idx} className=\"text-orange-700\">
                        {lesson.title} ({lesson.requirements?.join(', ') || lesson.status})
                      </li>
                    ))}
                    {eligibility.lesson_requirements.failed_lessons.length > 3 && (
                      <li className=\"text-gray-500\">
                        ...and {eligibility.lesson_requirements.failed_lessons.length - 3} more
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* Score Breakdown */}
            <div className=\"space-y-2\">
              <span className=\"font-medium text-gray-700\">Score Breakdown</span>
              <div className=\"grid grid-cols-2 gap-2 text-sm\">
                <div className=\"flex justify-between\">
                  <span>Lessons:</span>
                  <span className=\"font-medium\">{eligibility.scoring_breakdown.breakdown.lessons_average.toFixed(1)}%</span>
                </div>
                <div className=\"flex justify-between\">
                  <span>Quizzes:</span>
                  <span className=\"font-medium\">{eligibility.scoring_breakdown.breakdown.quiz_score.toFixed(1)}%</span>
                </div>
                <div className=\"flex justify-between\">
                  <span>Assignments:</span>
                  <span className=\"font-medium\">{eligibility.scoring_breakdown.breakdown.assignment_score.toFixed(1)}%</span>
                </div>
                <div className=\"flex justify-between\">
                  <span>Final:</span>
                  <span className=\"font-medium\">{eligibility.scoring_breakdown.breakdown.final_assessment.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <div className=\"space-y-2\">
                <span className=\"font-medium text-gray-700\">Recommendations</span>
                <ul className=\"space-y-1\">
                  {recommendations.slice(0, 3).map((rec, idx) => (
                    <li key={idx} className=\"flex items-start space-x-2 text-sm\">
                      <Badge 
                        variant=\"outline\" 
                        className={cn(
                          \"mt-0.5 text-xs\",
                          rec.priority === 'high' ? \"border-red-300 text-red-700\" :
                          rec.priority === 'medium' ? \"border-yellow-300 text-yellow-700\" :
                          \"border-green-300 text-green-700\"
                        )}
                      >
                        {rec.priority}
                      </Badge>
                      <span className=\"text-gray-700\">{rec.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EnhancedModuleUnlockCard;