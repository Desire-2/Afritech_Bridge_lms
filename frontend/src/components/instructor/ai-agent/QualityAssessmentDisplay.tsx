"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  FileText,
  Layout,
  BookOpen,
  Lightbulb,
  Palette,
  Ruler
} from 'lucide-react';
import { QualityAssessment } from '@/services/ai-agent.service';

interface QualityAssessmentDisplayProps {
  assessment: QualityAssessment;
  showDetails?: boolean;
  className?: string;
}

const QualityAssessmentDisplay: React.FC<QualityAssessmentDisplayProps> = ({
  assessment,
  showDetails = true,
  className = ''
}) => {
  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 0.8) return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    if (score >= 0.6) return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    return <XCircle className="w-4 h-4 text-red-600" />;
  };

  const aspectIcons = {
    completeness: <FileText className="w-4 h-4" />,
    structure: <Layout className="w-4 h-4" />,
    relevance: <BookOpen className="w-4 h-4" />,
    accuracy: <CheckCircle2 className="w-4 h-4" />,
    engagement: <Lightbulb className="w-4 h-4" />,
    clarity: <Palette className="w-4 h-4" />,
    educational_value: <TrendingUp className="w-4 h-4" />
  };

  const formatAspectName = (aspect: string) => {
    return aspect.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {getScoreIcon(assessment.overall_score)}
            Content Quality Assessment
          </CardTitle>
          <Badge 
            variant={assessment.overall_score >= 0.8 ? 'default' : 
                    assessment.overall_score >= 0.6 ? 'secondary' : 'destructive'}
          >
            {Math.round(assessment.overall_score * 100)}%
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Overall Score */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Overall Quality</span>
            <span className={`text-sm font-bold ${getScoreColor(assessment.overall_score)}`}>
              {Math.round(assessment.overall_score * 100)}%
            </span>
          </div>
          <Progress value={assessment.overall_score * 100} className="h-2" />
        </div>

        {/* Status Message */}
        {assessment.overall_score >= 0.8 ? (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Excellent quality! This content meets high educational standards.
            </AlertDescription>
          </Alert>
        ) : assessment.overall_score >= 0.6 ? (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              Good quality with room for improvement. Consider reviewing specific aspects below.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-red-200 bg-red-50">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Quality below standards. Please review and regenerate content.
            </AlertDescription>
          </Alert>
        )}

        {/* Detailed Breakdown */}
        {showDetails && assessment.detailed_scores && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Quality Breakdown</h4>
            <div className="grid gap-3">
              {Object.entries(assessment.detailed_scores).map(([aspect, score]) => (
                <div key={aspect} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    {aspectIcons[aspect as keyof typeof aspectIcons]}
                    <span className="text-sm">{formatAspectName(aspect)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20">
                      <Progress value={score * 100} className="h-1" />
                    </div>
                    <span className={`text-sm font-medium min-w-[3rem] text-right ${getScoreColor(score)}`}>
                      {Math.round(score * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feedback */}
        {assessment.feedback && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Feedback</h4>
            <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
              {assessment.feedback}
            </div>
          </div>
        )}

        {/* Suggestions for Improvement */}
        {assessment.suggestions && assessment.suggestions.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Suggestions for Improvement</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {assessment.suggestions.map((suggestion, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5">•</span>
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QualityAssessmentDisplay;