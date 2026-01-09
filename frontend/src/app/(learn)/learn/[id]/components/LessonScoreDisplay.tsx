import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Brain, ClipboardCheck, FileText } from 'lucide-react';

interface LessonScoreDisplayProps {
  readingProgress: number;
  engagementScore: number;
  quizScore?: number;
  assignmentScore?: number;
  lessonScore: number;
  hasQuiz?: boolean;
  hasAssignment?: boolean;
}

export const LessonScoreDisplay: React.FC<LessonScoreDisplayProps> = ({
  readingProgress,
  engagementScore,
  quizScore,
  assignmentScore,
  lessonScore,
  hasQuiz = false,
  hasAssignment = false
}) => {
  // Calculate dynamic weights and components based on available assessments
  const { components, formulaText, dynamicLessonScore } = useMemo(() => {
    let readingWeight: number;
    let engagementWeight: number;
    let quizWeight: number;
    let assignmentWeight: number;
    let formula: string;
    
    if (hasQuiz && hasAssignment) {
      // Full assessment: 25% each
      readingWeight = 25;
      engagementWeight = 25;
      quizWeight = 25;
      assignmentWeight = 25;
      formula = '(Reading + Engagement + Quiz + Assignment) × 25%';
    } else if (hasQuiz) {
      // Quiz only: Reading 35%, Engagement 35%, Quiz 30%
      readingWeight = 35;
      engagementWeight = 35;
      quizWeight = 30;
      assignmentWeight = 0;
      formula = '(Reading × 35%) + (Engagement × 35%) + (Quiz × 30%)';
    } else if (hasAssignment) {
      // Assignment only: Reading 35%, Engagement 35%, Assignment 30%
      readingWeight = 35;
      engagementWeight = 35;
      quizWeight = 0;
      assignmentWeight = 30;
      formula = '(Reading × 35%) + (Engagement × 35%) + (Assignment × 30%)';
    } else {
      // No assessments: Reading 50%, Engagement 50%
      readingWeight = 50;
      engagementWeight = 50;
      quizWeight = 0;
      assignmentWeight = 0;
      formula = '(Reading × 50%) + (Engagement × 50%)';
    }
    
    // Calculate the dynamic lesson score
    const calculatedScore = (
      (readingProgress * readingWeight / 100) +
      (engagementScore * engagementWeight / 100) +
      ((quizScore || 0) * quizWeight / 100) +
      ((assignmentScore || 0) * assignmentWeight / 100)
    );
    
    // Build components array (only include active components)
    const activeComponents = [];
    
    activeComponents.push({
      label: 'Reading',
      score: readingProgress,
      weight: readingWeight,
      icon: BookOpen,
      color: 'text-blue-400',
      bgColor: 'bg-blue-900/30',
      borderColor: 'border-blue-700'
    });
    
    activeComponents.push({
      label: 'Engagement',
      score: engagementScore,
      weight: engagementWeight,
      icon: Brain,
      color: 'text-green-400',
      bgColor: 'bg-green-900/30',
      borderColor: 'border-green-700'
    });
    
    if (hasQuiz) {
      activeComponents.push({
        label: 'Quiz',
        score: quizScore || 0,
        weight: quizWeight,
        icon: ClipboardCheck,
        color: 'text-purple-400',
        bgColor: 'bg-purple-900/30',
        borderColor: 'border-purple-700'
      });
    }
    
    if (hasAssignment) {
      activeComponents.push({
        label: 'Assignment',
        score: assignmentScore || 0,
        weight: assignmentWeight,
        icon: FileText,
        color: 'text-orange-400',
        bgColor: 'bg-orange-900/30',
        borderColor: 'border-orange-700'
      });
    }
    
    return {
      components: activeComponents,
      formulaText: formula,
      dynamicLessonScore: Math.round(calculatedScore)
    };
  }, [readingProgress, engagementScore, quizScore, assignmentScore, hasQuiz, hasAssignment]);

  // Use the passed lessonScore (from parent) as the primary source
  // This ensures consistency with the badge in the header
  const displayScore = lessonScore || dynamicLessonScore;
  const completionThreshold = 80;
  const isCompleted = displayScore >= completionThreshold;
  const pointsToCompletion = Math.max(0, completionThreshold - displayScore);

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-base sm:text-lg text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex flex-col">
            <span>Lesson Score</span>
            {!hasQuiz && !hasAssignment && (
              <span className="text-xs text-gray-400 font-normal mt-1">
                Based on Reading & Engagement only
              </span>
            )}
          </div>
          <div className="flex flex-col items-end">
            <span className={`text-2xl font-bold ${isCompleted ? 'text-green-400' : displayScore >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
              {Math.round(displayScore)}%
            </span>
            {isCompleted ? (
              <span className="text-xs text-green-400 font-normal">✓ Lesson Complete</span>
            ) : (
              <span className="text-xs text-yellow-400 font-normal">
                {pointsToCompletion.toFixed(0)}% more to complete
              </span>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Completion Progress Bar */}
        <div className="mb-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Completion Progress</span>
            <span className={isCompleted ? 'text-green-400' : 'text-yellow-400'}>
              {Math.round(displayScore)}% / {completionThreshold}%
            </span>
          </div>
          <div className="relative">
            <Progress 
              value={Math.min(displayScore, 100)} 
              className="h-3"
            />
            {/* Threshold marker */}
            <div 
              className="absolute top-0 h-3 w-0.5 bg-white/50"
              style={{ left: `${completionThreshold}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {isCompleted 
              ? '🎉 Great job! This lesson is complete and the next lesson is unlocked.'
              : `📚 Reach ${completionThreshold}% to complete this lesson and unlock the next one.`}
          </p>
        </div>
        
        <div className={`grid gap-2 sm:gap-3 ${
          components.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 
          components.length === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 
          'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
        }`}>
          {components.map((component) => {
            const Icon = component.icon;
            const weightedScore = (component.score * component.weight) / 100;
            
            return (
              <div 
                key={component.label}
                className={`p-3 rounded-lg border ${component.bgColor} ${component.borderColor}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Icon className={`h-4 w-4 ${component.color}`} />
                    <span className="text-sm font-medium text-gray-300">
                      {component.label}
                    </span>
                  </div>
                  <span className={`text-sm font-bold ${component.color}`}>
                    {Math.round(component.score)}%
                  </span>
                </div>
                <Progress 
                  value={component.score} 
                  className="h-2 mb-1"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Weight: {component.weight}%</span>
                  <span>Contributes: {weightedScore.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="pt-3 border-t border-gray-800">
          <div className="flex justify-between items-center text-sm text-gray-400 mb-2">
            <span>Formula: {formulaText}</span>
          </div>
          <Progress 
            value={displayScore} 
            className="h-3"
          />
          <p className="text-xs text-gray-500 mt-2">
            {hasQuiz || hasAssignment 
              ? 'Complete reading (90%+), stay engaged (60%+), and pass all assessments to complete this lesson.'
              : 'Complete reading (90%+) and stay engaged (60%+) to complete this lesson.'}
          </p>
          {!isCompleted && (
            <div className="mt-2 space-y-1">
              {displayScore < completionThreshold && (
                <p className="text-xs text-yellow-400">
                  Need {pointsToCompletion}% more to reach 80% completion threshold
                </p>
              )}
              {hasQuiz && (!quizScore || quizScore < 70) && (
                <p className="text-xs text-orange-400">
                  Quiz required: Pass with 70%+ (current: {Math.round(quizScore || 0)}%)
                </p>
              )}
              {hasAssignment && (!assignmentScore || assignmentScore < 70) && (
                <p className="text-xs text-orange-400">
                  Assignment required: Pass with 70%+ (current: {Math.round(assignmentScore || 0)}%)
                </p>
              )}
              {readingProgress < 90 && (
                <p className="text-xs text-blue-400">
                  Reading progress: {Math.round(readingProgress)}% (need 90%+)
                </p>
              )}
              {engagementScore < 60 && (
                <p className="text-xs text-green-400">
                  Engagement: {Math.round(engagementScore)}% (need 60%+)
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
