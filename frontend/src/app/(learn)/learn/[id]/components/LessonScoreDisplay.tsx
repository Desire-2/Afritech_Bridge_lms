import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Brain, ClipboardCheck, FileText } from 'lucide-react';

interface LessonScoreDisplayProps {
  readingProgress: number;
  engagementScore: number;
  quizScore?: number;
  assignmentScore?: number;
  lessonScore: number;
}

export const LessonScoreDisplay: React.FC<LessonScoreDisplayProps> = ({
  readingProgress,
  engagementScore,
  quizScore,
  assignmentScore,
  lessonScore
}) => {
  const components = [
    {
      label: 'Reading',
      score: readingProgress,
      weight: 25,
      icon: BookOpen,
      color: 'text-blue-400',
      bgColor: 'bg-blue-900/30',
      borderColor: 'border-blue-700'
    },
    {
      label: 'Engagement',
      score: engagementScore,
      weight: 25,
      icon: Brain,
      color: 'text-green-400',
      bgColor: 'bg-green-900/30',
      borderColor: 'border-green-700'
    },
    {
      label: 'Quiz',
      score: quizScore || 0,
      weight: 25,
      icon: ClipboardCheck,
      color: 'text-purple-400',
      bgColor: 'bg-purple-900/30',
      borderColor: 'border-purple-700'
    },
    {
      label: 'Assignment',
      score: assignmentScore || 0,
      weight: 25,
      icon: FileText,
      color: 'text-orange-400',
      bgColor: 'bg-orange-900/30',
      borderColor: 'border-orange-700'
    }
  ];

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader>
        <CardTitle className="text-lg text-white flex items-center justify-between">
          <span>Lesson Score</span>
          <span className={`text-2xl font-bold ${lessonScore >= 80 ? 'text-green-400' : lessonScore >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
            {Math.round(lessonScore)}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
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
            <span>Formula: (Reading + Engagement + Quiz + Assignment) × 25%</span>
          </div>
          <Progress 
            value={lessonScore} 
            className="h-3"
          />
          <p className="text-xs text-gray-500 mt-2">
            Complete reading, stay engaged, and finish assessments to maximize your lesson score.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
