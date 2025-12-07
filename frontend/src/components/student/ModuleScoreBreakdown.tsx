'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp, 
  TrendingDown, 
  CheckCircle, 
  AlertTriangle,
  Target,
  BookOpen,
  FileText,
  ClipboardCheck,
  Award,
  Info
} from 'lucide-react';
import ProgressApiService from '@/services/api/progress.service';

interface ModuleScoreBreakdownProps {
  moduleId: number;
  onScoreUpdate?: (score: number) => void;
}

interface ScoreBreakdown {
  cumulative_score: number;
  passing_threshold: number;
  is_passing: boolean;
  points_needed: number;
  breakdown: {
    course_contribution: ScoreComponent;
    quizzes: ScoreComponent;
    assignments: ScoreComponent;
    final_assessment: ScoreComponent;
  };
  recommendations: Recommendation[];
  attempts: {
    used: number;
    max: number;
    remaining: number;
    is_last_attempt: boolean;
  };
  status: string;
  can_proceed: boolean;
  assessment_info?: {
    has_quizzes: boolean;
    has_assignments: boolean;
    has_final_assessment: boolean;
    is_reading_only: boolean;
  };
}

interface ScoreComponent {
  score: number;
  weight: number;
  weighted_score: number;
  description: string;
  available?: boolean;
}

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  area: string;
  message: string;
}

const ModuleScoreBreakdown: React.FC<ModuleScoreBreakdownProps> = ({ 
  moduleId, 
  onScoreUpdate 
}) => {
  const [scoreData, setScoreData] = useState<ScoreBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadScoreBreakdown();
  }, [moduleId]);

  const loadScoreBreakdown = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ProgressApiService.getModuleScoreBreakdown(moduleId);
      setScoreData(data);
      if (onScoreUpdate) {
        onScoreUpdate(data.cumulative_score);
      }
    } catch (err: any) {
      console.error('Failed to load score breakdown:', err);
      setError(err.message || 'Failed to load score breakdown');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !scoreData) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error || 'Unable to load score breakdown'}
        </AlertDescription>
      </Alert>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-50 border-green-200';
    if (score >= 60) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const getComponentIcon = (key: string) => {
    switch (key) {
      case 'course_contribution': return <BookOpen className="h-5 w-5" />;
      case 'quizzes': return <ClipboardCheck className="h-5 w-5" />;
      case 'assignments': return <FileText className="h-5 w-5" />;
      case 'final_assessment': return <Award className="h-5 w-5" />;
      default: return <Target className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Overall Score Card */}
      <Card className={`border-2 ${getScoreBgColor(scoreData.cumulative_score)}`}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Module Progress</span>
            <Badge variant={scoreData.is_passing ? 'default' : 'destructive'}>
              {scoreData.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <div className={`text-5xl font-bold ${getScoreColor(scoreData.cumulative_score)}`}>
                {scoreData.cumulative_score.toFixed(1)}%
              </div>
              <p className="text-sm text-gray-600 mt-1">Current Score</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-gray-700">
                {scoreData.passing_threshold}%
              </div>
              <p className="text-sm text-gray-600">Required to Pass</p>
            </div>
          </div>

          <Progress 
            value={scoreData.cumulative_score} 
            className="h-3"
          />

          {!scoreData.is_passing && (
            <Alert>
              <Target className="h-4 w-4" />
              <AlertDescription>
                You need <strong>{scoreData.points_needed.toFixed(1)} more points</strong> to reach the passing threshold.
              </AlertDescription>
            </Alert>
          )}

          {scoreData.is_passing && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Congratulations! You've met the passing requirement.
              </AlertDescription>
            </Alert>
          )}

          {/* Assessment Info Banner */}
          {scoreData.assessment_info?.is_reading_only && (
            <Alert className="bg-blue-50 border-blue-200">
              <BookOpen className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                This module focuses on reading and engagement. Complete lessons with high engagement to achieve a good score.
              </AlertDescription>
            </Alert>
          )}

          {/* Attempt Information */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">Attempts</span>
            </div>
            <div className="text-sm">
              <span className="font-semibold">{scoreData.attempts.used}</span>
              <span className="text-gray-600"> / {scoreData.attempts.max}</span>
              {scoreData.attempts.is_last_attempt && (
                <Badge variant="destructive" className="ml-2">Last Attempt</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Score Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Score Breakdown</span>
            {scoreData.assessment_info?.is_reading_only && (
              <Badge variant="secondary">Reading Only Module</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(scoreData.breakdown)
            .filter(([key, component]) => component.weight > 0)
            .map(([key, component]) => (
            <div key={key} className={`border rounded-lg p-4 space-y-3 ${component.available === false ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${getScoreBgColor(component.score)}`}>
                    {getComponentIcon(key)}
                  </div>
                  <div>
                    <h4 className="font-semibold capitalize flex items-center gap-2">
                      {key.replace(/_/g, ' ')}
                      {component.available === false && (
                        <Badge variant="outline" className="text-xs">Not Available</Badge>
                      )}
                    </h4>
                    <p className="text-sm text-gray-600">{component.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-xl font-bold ${getScoreColor(component.score)}`}>
                    {component.score.toFixed(1)}%
                  </div>
                  <Badge variant="outline" className="mt-1">
                    {component.weight}% weight
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Contribution to total</span>
                  <span className="font-medium">{component.weighted_score.toFixed(2)} points</span>
                </div>
                <Progress 
                  value={component.score} 
                  className="h-2"
                />
              </div>
            </div>
          ))}
          
          {/* Show unavailable components as informational */}
          {Object.entries(scoreData.breakdown)
            .filter(([key, component]) => component.weight === 0)
            .length > 0 && (
            <div className="text-sm text-gray-500 mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="font-medium mb-1">Components not in this module:</p>
              <ul className="list-disc list-inside">
                {Object.entries(scoreData.breakdown)
                  .filter(([key, component]) => component.weight === 0)
                  .map(([key, component]) => (
                    <li key={key} className="capitalize">{key.replace(/_/g, ' ')}</li>
                  ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendations */}
      {scoreData.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {scoreData.is_passing ? (
                <>
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span>Keep Up the Good Work</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-5 w-5 text-yellow-600" />
                  <span>Areas to Improve</span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {scoreData.recommendations.map((rec, index) => (
              <Alert key={index} variant={rec.priority === 'high' ? 'destructive' : 'default'}>
                <div className="flex items-start gap-3">
                  <Badge variant={getPriorityColor(rec.priority)} className="mt-0.5">
                    {rec.priority}
                  </Badge>
                  <AlertDescription className="flex-1">
                    <strong className="capitalize">{rec.area.replace('_', ' ')}: </strong>
                    {rec.message}
                  </AlertDescription>
                </div>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ModuleScoreBreakdown;
