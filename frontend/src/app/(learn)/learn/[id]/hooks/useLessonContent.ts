"use client";

import { useState, useCallback, useEffect } from "react";
import ContentAssignmentService, {
  type ContentQuiz,
  type ContentAssignment,
} from "@/services/contentAssignmentApi";

export function useLessonContent(currentLessonId: number | undefined) {
  const [lessonQuiz, setLessonQuiz] = useState<ContentQuiz | null>(null);
  const [lessonAssignments, setLessonAssignments] = useState<ContentAssignment[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentLoadedForLesson, setContentLoadedForLesson] = useState<number | null>(null);
  const [quizLoadError, setQuizLoadError] = useState<string | null>(null);
  const [lessonAssessments, setLessonAssessments] = useState<{
    [lessonId: number]: any[];
  }>({});

  const loadLessonContent = useCallback(async (lessonId: number) => {
    if (!lessonId) return;

    setContentLoading(true);
    setQuizLoadError(null);

    try {
      const [quizResponse, assignmentsResponse] = await Promise.all([
        ContentAssignmentService.getLessonQuiz(lessonId).catch((err) => {
          const msg =
            err.response?.data?.message || err.message || "Failed to load quiz";
          setQuizLoadError(msg);
          return { lesson: null, quiz: null, quizzes: [] };
        }),
        ContentAssignmentService.getLessonAssignments(lessonId).catch(() => ({
          lesson: null,
          assignments: [],
        })),
      ]);

      setLessonQuiz(quizResponse.quiz);
      setLessonAssignments(assignmentsResponse.assignments || []);

      // Build assessments map for sidebar
      const assessments: any[] = [];
      const quizzesToDisplay =
        quizResponse.quizzes && quizResponse.quizzes.length > 0
          ? quizResponse.quizzes
          : quizResponse.quiz
            ? [quizResponse.quiz]
            : [];

      quizzesToDisplay.forEach((quiz: any) => {
        assessments.push({
          id: quiz.id,
          title: quiz.title || "Quiz",
          type: "quiz",
          status: quiz.completed ? "completed" : "pending",
          dueDate: quiz.due_date,
        });
      });

      if (assignmentsResponse.assignments?.length) {
        assignmentsResponse.assignments.forEach((assignment: any) => {
          assessments.push({
            id: assignment.id,
            title: assignment.title || "Assignment",
            type: "assignment",
            status: assignment.status || "pending",
            dueDate: assignment.due_date,
          });
        });
      }

      setLessonAssessments((prev) => ({
        ...prev,
        [lessonId]: assessments,
      }));
      setContentLoadedForLesson(lessonId);
    } catch (error) {
      console.error("Error loading lesson content:", error);
      setContentLoadedForLesson(lessonId);
    } finally {
      setContentLoading(false);
    }
  }, []);

  const reloadLessonContent = useCallback(() => {
    if (currentLessonId) {
      loadLessonContent(currentLessonId);
    }
  }, [currentLessonId, loadLessonContent]);

  useEffect(() => {
    if (currentLessonId) {
      loadLessonContent(currentLessonId);
    }
  }, [currentLessonId, loadLessonContent]);

  // Scores derived from quiz/assignment data
  const [currentLessonQuizScore, setCurrentLessonQuizScore] = useState(0);
  const [currentLessonAssignmentScore, setCurrentLessonAssignmentScore] =
    useState(0);

  useEffect(() => {
    if (!currentLessonId) return;

    if (lessonQuiz) {
      const bestScore =
        (lessonQuiz as any).best_score ??
        (lessonQuiz as any).current_score ??
        0;
      setCurrentLessonQuizScore(bestScore);
    } else {
      setCurrentLessonQuizScore(0);
    }

    if (lessonAssignments.length > 0) {
      const scores = lessonAssignments.map((a: any) => {
        if (
          a.submission_status?.score !== undefined &&
          a.submission_status?.score !== null
        ) {
          const total = a.points_possible || 100;
          return (a.submission_status.score / total) * 100;
        }
        return 0;
      });
      const avg =
        scores.length > 0
          ? scores.reduce((sum, s) => sum + s, 0) / scores.length
          : 0;
      setCurrentLessonAssignmentScore(avg);
    } else {
      setCurrentLessonAssignmentScore(0);
    }
  }, [currentLessonId, lessonQuiz, lessonAssignments]);

  return {
    lessonQuiz,
    setLessonQuiz,
    lessonAssignments,
    setLessonAssignments,
    contentLoading,
    contentLoadedForLesson,
    quizLoadError,
    lessonAssessments,
    currentLessonQuizScore,
    setCurrentLessonQuizScore,
    currentLessonAssignmentScore,
    setCurrentLessonAssignmentScore,
    reloadLessonContent,
    loadLessonContent,
  };
}
