'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, XCircle, TrendingDown, Target, BookOpen } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress';

interface ModuleStatus {
  module_id?: number;
  module_name: string;
  status: 'completed' | 'failed' | 'in_progress' | 'not_started';
  score: number;
  passing: boolean;
}

interface CertificateErrorDisplayProps {
  requirements?: {
    passing_score: number;
    overall_score: number;
    completed_modules: number;
    total_modules: number;
    failed_modules: number;
    module_details?: ModuleStatus[];
  };
  failureReasons?: {
    incomplete_modules?: {
      remaining: number;
      message?: string;
      modules_list?: Array<{ module_name: string; status: string; score: number }>;
    };
    failed_modules?: {
      count: number;
      message?: string;
      failed_modules_list?: Array<{ name: string; score: number; gap: number }>;
    };
    insufficient_score?: {
      current_score: number;
      required_score: number;
      gap: number;
      message?: string;
    };
  };
  nextSteps?: string[];
  errorMessage?: string;
  summary?: string;
}

export const CertificateErrorDisplay: React.FC<CertificateErrorDisplayProps> = ({
  requirements,
  failureReasons,
  nextSteps = [],
  errorMessage = 'Certificate requirements not met',
  summary
}) => {
  if (!requirements || !failureReasons) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{errorMessage}</AlertDescription>
      </Alert>
    );
  }

  const passingScore = requirements.passing_score || 80;
  const overallScore = requirements.overall_score || 0;
  const completedModules = requirements.completed_modules || 0;
  const totalModules = requirements.total_modules || 0;
  const failedModules = requirements.failed_modules || 0;
  const moduleDetails = requirements.module_details || [];

  return (
    <div className="space-y-6">
      {/* Main Error Alert */}
      <Alert variant="destructive" className="border-2">
        <AlertCircle className="h-5 w-5" />
        <AlertTitle className="text-lg">Certificate Requirements Not Met</AlertTitle>
        <AlertDescription className="mt-2 text-base">
          {summary || 'You need to meet the following requirements to earn your certificate.'}
        </AlertDescription>
      </Alert>

      {/* Overall Score Section */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="w-5 h-5 text-orange-600" />
            Overall Score Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold">Current Score</span>
            <span className={`text-2xl font-bold ${overallScore >= passingScore ? 'text-green-600' : 'text-orange-600'}`}>
              {overallScore.toFixed(1)}%
            </span>
          </div>
          <ProgressBar 
            value={Math.min(overallScore, 100)} 
            max={100}
            className="h-3"
          />
          <div className="flex justify-between text-sm text-gray-600">
            <span>Required: {passingScore}%</span>
            <span>
              {overallScore >= passingScore ? (
                <span className="text-green-600 font-semibold">✓ Target Reached</span>
              ) : (
                <span className="text-orange-600 font-semibold">
                  Need {(passingScore - overallScore).toFixed(1)}% more
                </span>
              )}
            </span>
          </div>

          {failureReasons.insufficient_score && overallScore < passingScore && (
            <div className="bg-white border border-orange-200 rounded p-3 mt-3">
              <p className="text-sm text-gray-700">
                {failureReasons.insufficient_score.message || 
                  `Your current score is ${overallScore.toFixed(1)}%. You need at least ${passingScore}% to be eligible for a certificate.`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Module Completion Section */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="w-5 h-5 text-blue-600" />
            Module Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold">Modules Completed</span>
            <span className="text-2xl font-bold text-blue-600">
              {completedModules}/{totalModules}
            </span>
          </div>
          <ProgressBar 
            value={completedModules} 
            max={totalModules}
            className="h-3"
          />

          {failureReasons.incomplete_modules && completedModules < totalModules && (
            <div className="bg-white border border-blue-200 rounded p-4 mt-4 space-y-3">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" />
                <span className="font-semibold text-gray-700">
                  {failureReasons.incomplete_modules.remaining} module(s) not completed
                </span>
              </div>
              {failureReasons.incomplete_modules.modules_list && failureReasons.incomplete_modules.modules_list.length > 0 && (
                <ul className="space-y-2 ml-7">
                  {failureReasons.incomplete_modules.modules_list.map((module, idx) => (
                    <li key={idx} className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                        <span className="font-medium">{module.module_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {module.status === 'not_started' ? 'Not Started' : 'In Progress'}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-sm text-gray-600 mt-3 pl-7">
                {failureReasons.incomplete_modules.message || 
                  `Complete the remaining ${failureReasons.incomplete_modules.remaining} module(s) to progress.`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Failed Modules Section */}
      {failureReasons.failed_modules && failureReasons.failed_modules.count > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingDown className="w-5 h-5 text-red-600" />
              Modules Below Passing Score
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-700 mb-4">
              {failureReasons.failed_modules.message || 
                `${failureReasons.failed_modules.count} module(s) with scores below ${passingScore}%`}
            </div>

            {failureReasons.failed_modules.failed_modules_list && (
              <div className="space-y-3">
                {failureReasons.failed_modules.failed_modules_list.map((module, idx) => (
                  <div key={idx} className="bg-white border border-red-200 rounded p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-semibold text-gray-800">{module.name}</h4>
                      <Badge variant="destructive" className="text-sm">
                        {module.score.toFixed(1)}%
                      </Badge>
                    </div>
                    
                    <ProgressBar 
                      value={module.score} 
                      max={100}
                      className="h-2 mb-2"
                    />
                    
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Current: {module.score.toFixed(1)}%</span>
                      <span className="font-semibold text-red-600">
                        Need {module.gap.toFixed(1)}% more
                      </span>
                    </div>
                    
                    <p className="text-xs text-gray-500 mt-2">
                      Required score: {passingScore}%
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Module Breakdown */}
      {moduleDetails && moduleDetails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Module Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {moduleDetails.map((module, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div className="flex items-center gap-3 flex-1">
                    {module.passing ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{module.module_name}</p>
                      <p className="text-xs text-gray-500 capitalize">{module.status}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-semibold ${module.passing ? 'text-green-600' : 'text-red-600'}`}>
                      {module.score.toFixed(1)}%
                    </span>
                    <Badge variant={module.passing ? 'default' : 'destructive'} className="whitespace-nowrap">
                      {module.passing ? 'Pass' : 'Below 80%'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next Steps */}
      {nextSteps && nextSteps.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-lg">Next Steps to Get Your Certificate</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {nextSteps.map((step, idx) => (
                <li key={idx} className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center w-6 h-6 bg-green-600 text-white rounded-full text-sm font-semibold">
                      {idx + 1}
                    </div>
                  </div>
                  <p className="text-gray-700 pt-0.5">{step}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Retry Suggestion */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-gray-700">
          💡 <strong>Tip:</strong> Once you complete the above requirements, return to this course to generate your certificate.
        </p>
      </div>
    </div>
  );
};
