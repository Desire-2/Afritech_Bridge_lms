"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle, Clock } from "lucide-react";
import { assessmentTypeVariant, STATUS_COLORS } from "@/lib/lms-ui/variants";

interface AssessmentBadgeProps {
  id: number;
  title: string;
  type: "quiz" | "assignment" | "project";
  status?: "pending" | "in_progress" | "completed";
  isCompleted?: boolean;
  score?: number;
  passed?: boolean;
  canAccess: boolean;
  onClick: () => void;
}

export const AssessmentBadge: React.FC<AssessmentBadgeProps> = ({
  id,
  title,
  type,
  status,
  isCompleted = false,
  score,
  passed,
  canAccess,
  onClick,
}) => {
  const colors = isCompleted && passed
    ? STATUS_COLORS.completed
    : type === "quiz"
      ? STATUS_COLORS.info
      : type === "assignment"
        ? STATUS_COLORS.warning
        : STATUS_COLORS.locked;

  const handleClick = () => {
    if (canAccess) onClick();
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            onClick={handleClick}
            className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded border text-[10px] sm:text-xs transition-all duration-200 ${assessmentTypeVariant({ type })} ${
              !canAccess
                ? "opacity-50 cursor-not-allowed"
                : isCompleted
                  ? "ring-1 ring-green-500/50 cursor-pointer hover:scale-105 hover:shadow-md"
                  : "cursor-pointer hover:scale-105"
            }`}
            role="button"
            tabIndex={canAccess ? 0 : -1}
            aria-disabled={!canAccess}
            aria-label={`${type}: ${title}${isCompleted ? ` (${score}%)` : ""}`}
            onKeyDown={(e) => {
              if (canAccess && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onClick();
              }
            }}
          >
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-[10px] sm:text-xs capitalize">
                {type}
              </p>
              <p className="text-[9px] sm:text-xs opacity-75 truncate">
                {title}
              </p>
              {isCompleted && score !== undefined && (
                <p
                  className={`text-[9px] sm:text-xs font-semibold ${
                    passed ? "text-green-400" : "text-yellow-400"
                  }`}
                >
                  Score: {Math.round(score)}%
                </p>
              )}
            </div>
            {isCompleted ? (
              <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0 text-green-400" />
            ) : status === "in_progress" ? (
              <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0 text-yellow-400" />
            ) : (
              <span className="text-[9px] sm:text-xs opacity-60">pending</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <p className="font-semibold text-sm capitalize">{type}</p>
          <p className="text-xs text-gray-200 mt-1">{title}</p>
          {isCompleted && (
            <p className={`text-xs mt-1 ${passed ? "text-green-400" : "text-yellow-400"}`}>
              Score: {Math.round(score || 0)}%
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {isCompleted ? "✓ Completed" : status || "Pending"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
