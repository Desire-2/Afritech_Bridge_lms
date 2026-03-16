'use client';

import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, XCircle, Clock, TrendingUp, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ProgressBar } from '@/components/ui/progress';

interface ModuleDetail {
  module_id?: number;
  module_name: string;
  status: 'completed' | 'failed' | 'in_progress' | 'not_started';
  score: number;
  passing: boolean;
}

interface CertificateRequirementsDetailProps {
  requirements: {
    passing_score: number;
    overall_score: number;
    completed_modules: number;
    total_modules: number;
    failed_modules: number;
    module_details: ModuleDetail[];
  };
  failureReasons: {
    incomplete_modules?: {
      remaining: number;
      modules_list: Array<{ module_name: string; status: string; score: number }>;
    };
    failed_modules?: {
      count: number;
      failed_modules_list: Array<{ name: string; score: number; gap: number }>;
    };
    insufficient_score?: {
      current_score: number;
      required_score: number;
      gap: number;
    };
  };
  nextSteps?: string[];
  isEligible: boolean;
  onRetry?: () => void;
  isLoading?: boolean;
}

export const CertificateRequirementsDetail: React.FC<CertificateRequirementsDetailProps> = ({
  requirements,
  failureReasons,
  nextSteps = [],
  isEligible,
  onRetry,
  isLoading = false
}) => {
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  const getModuleStatusIcon = (status: string, passing: boolean) => {
    if (status === 'completed' && passing) {
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    }
    if (status === 'failed' || !passing) {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
    if (status === 'in_progress') {
      return <Clock className="w-5 h-5 text-yellow-500" />;
    }
    return <AlertCircle className="w-5 h-5 text-gray-400" />;
  };

  const getModuleStatusBadgeColor = (status: string, passing: boolean) => {
    if (status === 'completed' && passing) return 'bg-green-100 text-green-800';
    if (status === 'failed' || !passing) return 'bg-red-100 text-red-800';
    if (status === 'in_progress') return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getModuleStatusLabel = (status: string, score: number) => {
    if (status === 'completed') return `✓ Passed (${score.toFixed(1)}%)`;
    if (status === 'failed') return `✗ Failed (${score.toFixed(1)}%)`;
    if (status === 'in_progress') return `⟳ In Progress (${score.toFixed(1)}%)`;
    return '○ Not Started (0%)';
  };

  return (
    <div className="space-y-6">
      {/* Overall Status Card */}
      <Card className={!isEligible ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isEligible ? (
              <>
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                <span className="text-green-900">Ready for Certificate!</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-6 h-6 text-red-600" />
                <span className="text-red-900">Requirements Not Met</span>
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall Score */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Overall Score</span>
              <span className={`text-lg font-bold ${
                requirements.overall_score >= requirements.passing_score 
                  ? 'text-green-600' 
                  : 'text-red-600'
              }`}>
                {requirements.overall_score.toFixed(1)}% / {requirements.passing_score}%
              </span>
            </div>
            <ProgressBar 
              value={Math.min(requirements.overall_score, 100)} 
              max={100}
              className={requirements.overall_score >= requirements.passing_score 
                ? 'bg-green-200' 
                : 'bg-red-200'
              }
            />
          </div>

          {/* Module Completion */}
          <div className="pt-2 border-t">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Modules Completed</span>
              <span className={`text-lg font-bold ${
                requirements.completed_modules === requirements.total_modules
                  ? 'text-green-600'
                  : 'text-yellow-600'
              }`}>
                {requirements.completed_modules} / {requirements.total_modules}
              </span>
            </div>
            <ProgressBar
              value={requirements.completed_modules}
              max={requirements.total_modules}
              className={requirements.completed_modules === requirements.total_modules
                ? 'bg-green-200'
                : 'bg-yellow-200'
              }
            />
          </div>

          {/* Status Summary */}
          <div className="pt-2 border-t">
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {requirements.module_details.filter(m => m.passing).length}
                </div>
                <div className="text-xs text-gray-600">Passing</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {requirements.failed_modules}
                </div>
                <div className="text-xs text-gray-600">Failing</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-600">
                  {requirements.total_modules - requirements.completed_modules}
                </div>
                <div className="text-xs text-gray-600">Not Done</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Failure Reasons */}
      {!isEligible && Object.keys(failureReasons).length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-lg text-orange-900">Why You're Not Eligible</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {failureReasons.incomplete_modules && (
              <div className="flex gap-3 p-3 bg-white rounded border border-orange-200">
                <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm text-orange-900">
                    {failureReasons.incomplete_modules.remaining} Module(s) Not Completed
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {failureReasons.incomplete_modules.modules_list.map((m, i) => (
                      <div key={i}>• {m.module_name}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {failureReasons.failed_modules && (
              <div className="flex gap-3 p-3 bg-white rounded border border-orange-200">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm text-orange-900">
                    {failureReasons.failed_modules.count} Module(s) Below Passing Score
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {failureReasons.failed_modules.failed_modules_list.map((m, i) => (
                      <div key={i}>• {m.name}: {m.score.toFixed(1)}% (need {m.gap.toFixed(1)}% more)</div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {failureReasons.insufficient_score && (
              <div className="flex gap-3 p-3 bg-white rounded border border-orange-200">
                <TrendingUp className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm text-orange-900">
                    Overall Score {failureReasons.insufficient_score.gap.toFixed(1)}% Below Required
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Current: {failureReasons.insufficient_score.current_score.toFixed(1)}% | Need: {failureReasons.insufficient_score.required_score}%
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Module Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Module Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-h-96 overflow-y-auto">
          {requirements.module_details.map((module, index) => (
            <div
              key={index}
              className="p-3 border rounded-lg hover:bg-gray-50 transition-colors"
              onClick={() => setExpandedModule(expandedModule === module.module_name ? null : module.module_name)}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  {getModuleStatusIcon(module.status, module.passing)}
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-900">{module.module_name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {getModuleStatusLabel(module.status, module.score)}
                    </div>
                  </div>
                </div>
                <Badge className={getModuleStatusBadgeColor(module.status, module.passing)}>
                  {module.score.toFixed(1)}%
                </Badge>
              </div>

              {/* Expanded Details */}
              {expandedModule === module.module_name && (
                <div className="mt-3 pt-3 border-t space-y-2 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className="font-medium capitalize">{module.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Score:</span>
                    <span className="font-medium">{module.score.toFixed(1)}%</span>
                  </div>
                  {module.status === 'failed' || !module.passing ? (
                    <div className="flex justify-between text-orange-600">
                      <span>Gap to Pass:</span>
                      <span className="font-medium">{Math.max(0, 80 - module.score).toFixed(1)}%</span>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Next Steps */}
      {nextSteps && nextSteps.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg text-blue-900 flex items-center gap-2">
              <ArrowRight className="w-5 h-5" />
              Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {nextSteps.map((step, index) => (
                <div key={index} className="flex gap-3 p-2 bg-white rounded border border-blue-200">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <div className="text-sm text-gray-700">{step}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {isEligible ? (
          <Button className="flex-1 bg-green-600 hover:bg-green-700" disabled={isLoading}>
            {isLoading ? 'Generating Certificate...' : 'Generate Certificate'}
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              className="flex-1"
              onClick={onRetry}
              disabled={isLoading}
            >
              {isLoading ? 'Checking...' : 'Check Again'}
            </Button>
            <Button className="flex-1" disabled>
              Generate Certificate
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
