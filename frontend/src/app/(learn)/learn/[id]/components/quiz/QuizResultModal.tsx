"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Trophy,
  AlertCircle,
  CheckCircle,
  RefreshCw,
} from "lucide-react";

interface QuizResultModalProps {
  score: number;
  passed: boolean;
  attemptNumber: number;
  totalAttempts: number;
  remainingAttempts: number;
  passingScore: number;
  bestScore?: number;
  canRetake: boolean;
  isBlockedByViolation: boolean;
  onRetake: () => void;
  onClose: () => void;
}

export const QuizResultModal: React.FC<QuizResultModalProps> = ({
  score,
  passed,
  attemptNumber,
  totalAttempts,
  remainingAttempts,
  passingScore,
  canRetake,
  isBlockedByViolation,
  onRetake,
  onClose,
}) => {
  return (
    <div className="space-y-4 py-4">
      {/* Score Display */}
      <div className="text-center">
        <div
          className={`inline-flex h-24 w-24 items-center justify-center rounded-full mb-4 ${
            passed
              ? "bg-green-100 dark:bg-green-900"
              : "bg-yellow-100 dark:bg-yellow-900"
          }`}
        >
          {passed ? (
            <Trophy className="h-12 w-12 text-green-600 dark:text-green-400" />
          ) : (
            <AlertCircle className="h-12 w-12 text-yellow-600 dark:text-yellow-400" />
          )}
        </div>
        <div
          className={`text-5xl font-bold mb-2 ${
            passed
              ? "text-green-600 dark:text-green-400"
              : "text-yellow-600 dark:text-yellow-400"
          }`}
        >
          {score}%
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {passed ? "Passed! Great job!" : `Need ${passingScore}% to pass`}
        </p>
        <div className="text-xs text-gray-500 mt-2">
          Attempt {attemptNumber}{" "}
          {totalAttempts > 0 ? `of ${totalAttempts}` : ""}
          {bestScore !== undefined && (
            <span className="ml-2">Best: {bestScore}%</span>
          )}
        </div>
      </div>

      {/* Status Message */}
      {!passed && !canRetake && !isBlockedByViolation && (
        <Alert className="border-red-400 bg-red-50 dark:bg-red-950/30">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <AlertTitle className="text-red-900 dark:text-red-300 font-bold">
            ⚠️ Important
          </AlertTitle>
          <AlertDescription className="text-red-800 dark:text-red-300 space-y-2">
            <p>
              You have reached the maximum number of attempts without passing.
              Review the lesson content carefully before moving forward.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {!passed && canRetake && (
        <Alert className="border-blue-300 bg-blue-50 dark:bg-blue-950/30">
          <CheckCircle className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-900 dark:text-blue-300 font-semibold">
            📚 Study Recommendation
          </AlertTitle>
          <AlertDescription className="text-blue-800 dark:text-blue-300">
            Review the lesson content and try again.
          </AlertDescription>
        </Alert>
      )}

      {passed && (
        <Alert className="border-green-300 bg-green-50 dark:bg-green-950/30">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-300">
            Congratulations! You passed this quiz!
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        {!passed && canRetake && (
          <Button
            onClick={onRetake}
            className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retake Quiz
          </Button>
        )}
        <Button
          onClick={onClose}
          variant={!passed && canRetake ? "outline" : "default"}
          className={!passed && !canRetake ? "w-full" : "flex-1"}
        >
          Close
        </Button>
      </div>
    </div>
  );
};
