"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Timer, Clock } from "lucide-react";

interface QuizTimerProps {
  timeElapsed: number;
  timeRemaining: number | null;
  hasTimeLimit: boolean;
}

export const QuizTimer: React.FC<QuizTimerProps> = ({
  timeElapsed,
  timeRemaining,
  hasTimeLimit,
}) => {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isWarning = timeRemaining !== null && timeRemaining <= 60;

  return (
    <div className="flex items-center space-x-3 sm:space-x-4">
      <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
        <Timer className="h-4 w-4" />
        <span className="font-mono font-semibold">
          {formatTime(timeElapsed)}
        </span>
      </div>
      {hasTimeLimit && timeRemaining !== null && (
        <Badge
          variant="destructive"
          className={`shadow-sm text-base font-bold ${
            isWarning ? "animate-pulse bg-red-600" : ""
          }`}
        >
          <Clock className="h-4 w-4 mr-1" />
          {formatTime(timeRemaining)}
        </Badge>
      )}
    </div>
  );
};
