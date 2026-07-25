"use client";

import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Play,
  RefreshCw,
  Clock,
  FileText,
  CheckCircle,
  AlertCircle,
  Trophy,
  XCircle,
} from "lucide-react";

interface QuizPreScreenProps {
  quiz: any;
  onStart: () => void;
  canAttempt: boolean;
  attemptsUsed: number;
  maxAttempts: number;
  isBlockedByViolation: boolean;
}

export const QuizPreScreen: React.FC<QuizPreScreenProps> = ({
  quiz,
  onStart,
  canAttempt,
  attemptsUsed,
  maxAttempts,
  isBlockedByViolation,
}) => {
  const questions = quiz.questions || [];

  if (!questions || questions.length === 0) {
    return (
      <Alert className="border-yellow-700 bg-yellow-900/30">
        <AlertCircle className="h-4 w-4 text-yellow-400" />
        <AlertTitle className="text-yellow-300">Quiz Not Available</AlertTitle>
        <AlertDescription className="text-yellow-200">
          This quiz has no questions yet. Please check back later or contact
          your instructor.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {isBlockedByViolation && (
        <Alert className="border-red-700 bg-red-900/30">
          <XCircle className="h-5 w-5 text-red-400" />
          <AlertTitle className="text-red-300 text-lg font-bold">
            Quiz Blocked - Security Violation
          </AlertTitle>
          <AlertDescription className="text-red-200">
            <p className="mb-2">
              All remaining attempts have been blocked due to a security policy
              violation. Contact your instructor if you believe this was an
              error.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {!canAttempt && !isBlockedByViolation && (
        <Alert className="border-red-700 bg-red-900/30">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <AlertTitle className="text-red-300">
            Maximum Attempts Reached
          </AlertTitle>
          <AlertDescription className="text-red-200">
            You have used all {maxAttempts} attempts for this quiz.
            {quiz.best_score && ` Your best score: ${quiz.best_score}%`}
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950 dark:via-indigo-950 dark:to-purple-950 shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                  <FileText className="h-3 w-3 mr-1" />
                  Quiz
                </Badge>
                {quiz.best_score && (
                  <Badge variant="outline" className="bg-white/50 backdrop-blur-sm">
                    Best: {quiz.best_score}%
                  </Badge>
                )}
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {quiz.title}
              </h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm sm:text-base">
                {quiz.description}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <StatCard
              icon={<FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
              value={questions.length}
              label="Questions"
              color="blue"
            />
            <StatCard
              icon={<Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
              value={quiz.time_limit ? `${quiz.time_limit}` : "∞"}
              label={quiz.time_limit ? "Minutes" : "No Time Limit"}
              color={quiz.time_limit ? "orange" : "green"}
            />
            <StatCard
              icon={<Trophy className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
              value={`${quiz.passing_score || 70}%`}
              label="Passing Score"
              color="purple"
            />
            <StatCard
              icon={<RefreshCw className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
              value={maxAttempts === -1 ? "∞" : `${maxAttempts}`}
              label={maxAttempts === -1 ? "Unlimited" : "Max Attempts"}
              color="indigo"
            />
          </div>

          {/* Instructions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 sm:p-6 mb-6 border border-gray-200 dark:border-gray-700 shadow-md">
            <h4 className="font-bold text-gray-900 dark:text-white text-base sm:text-lg mb-4 flex items-center">
              <div className="p-1.5 bg-blue-100 dark:bg-blue-900 rounded-lg mr-3">
                <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              Quiz Instructions
            </h4>
            <ul className="space-y-3 text-gray-700 dark:text-gray-300 text-sm sm:text-base">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Read each question carefully before answering</span>
              </li>
              {quiz.time_limit && (
                <li className="flex items-start gap-2">
                  <Clock className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <span>
                    You have{" "}
                    <strong>{quiz.time_limit} minutes</strong> to complete
                  </span>
                </li>
              )}
              <li className="flex items-start gap-2">
                <Trophy className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
                <span>
                  You need <strong>{quiz.passing_score || 70}%</strong> to pass
                </span>
              </li>
            </ul>
          </div>

          {/* Security Warning */}
          <Alert className="bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-700">
            <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <AlertTitle className="text-orange-900 dark:text-orange-300 font-bold">
              🔒 Security Policy
            </AlertTitle>
            <AlertDescription className="text-orange-800 dark:text-orange-300">
              <p className="mb-2 font-semibold">
                This quiz is monitored for academic integrity:
              </p>
              <ul className="list-disc ml-5 space-y-1 text-sm">
                <li>No tab switching or window changes</li>
                <li>Screenshots and screen recording blocked</li>
                <li>Copy/paste is disabled</li>
                <li className="text-red-700 dark:text-red-400 font-bold">
                  ⚠️ 3 violations = Automatic 0 score &amp; all remaining
                  attempts blocked
                </li>
              </ul>
            </AlertDescription>
          </Alert>

          <Button
            onClick={onStart}
            disabled={!canAttempt}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-6 sm:py-7 text-lg sm:text-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6"
          >
            {canAttempt ? (
              <>
                {attemptsUsed > 0 ? (
                  <>
                    <RefreshCw className="h-6 w-6 mr-2" />
                    Retake Quiz
                  </>
                ) : (
                  <>
                    <Play className="h-6 w-6 mr-2" />
                    Start Quiz
                  </>
                )}
              </>
            ) : (
              <>
                <XCircle className="h-6 w-6 mr-2" />
                Max Attempts Reached
              </>
            )}
          </Button>

          {maxAttempts !== -1 && (
            <div className="mt-4 text-center text-sm text-gray-600">
              Attempts: {attemptsUsed} / {maxAttempts}
              {quiz.best_score && ` • Best Score: ${quiz.best_score}%`}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Small stat card helper
const StatCard: React.FC<{
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color: string;
}> = ({ icon, value, label }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 text-center border border-gray-100 dark:border-gray-700 shadow-md hover:shadow-lg transition-all">
    <div className="flex justify-center mb-2">{icon}</div>
    <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
      {value}
    </div>
    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
      {label}
    </div>
  </div>
);
