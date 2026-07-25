"use client";

import React from "react";

interface QuizNavigationGridProps {
  totalQuestions: number;
  currentIndex: number;
  answers: Record<number, string>;
  questions: any[];
  onNavigate: (index: number) => void;
}

export const QuizNavigationGrid: React.FC<QuizNavigationGridProps> = ({
  totalQuestions,
  currentIndex,
  answers,
  questions,
  onNavigate,
}) => {
  if (totalQuestions <= 1) return null;

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
        Question Navigator
      </p>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: totalQuestions }).map((_, i) => {
          const question = questions[i];
          const isAnswered = question && answers[question.id]?.trim().length > 0;
          const isCurrent = i === currentIndex;

          return (
            <button
              key={i}
              onClick={() => onNavigate(i)}
              className={`w-8 h-8 rounded-lg text-xs font-bold transition-all duration-150 ${
                isCurrent
                  ? "ring-2 ring-blue-500 bg-blue-600 text-white scale-110"
                  : isAnswered
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                    : "bg-gray-700/50 text-gray-400 border border-gray-600/50 hover:bg-gray-600/50"
              }`}
              aria-label={`Go to question ${i + 1}${isAnswered ? " (answered)" : ""}`}
              aria-current={isCurrent ? "true" : undefined}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
};
