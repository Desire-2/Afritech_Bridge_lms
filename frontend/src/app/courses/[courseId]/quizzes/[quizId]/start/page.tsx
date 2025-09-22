"use client";

import React, { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AuthContext } from '@/contexts/AuthContext';

// Placeholder types - align with lms_phase3_quiz_design.md
interface QuizDetails {
  id: string;
  title: string;
  description: string;
  instructions: string[];
  questionCount: number;
  timeLimitMinutes: number | null;
  allowedAttempts: number;
  gradingPolicy: string;
  courseId: string; // For breadcrumbs/back navigation
  courseTitle: string;
}

interface QuizAttemptSummary {
  attemptsTaken: number;
  lastScore?: number | null; // Score of the last attempt if available
  canViewResults: boolean;
  canRetake: boolean;
}

// Placeholder data - replace with API calls
const placeholderQuizDetails: QuizDetails = {
  id: 'q123',
  title: 'Chapter 1 Review Quiz',
  description: 'This quiz covers the fundamental concepts introduced in Chapter 1. Please read all instructions carefully before starting.',
  instructions: [
    'This quiz consists of 10 multiple-choice questions.',
    'You will have 30 minutes to complete the quiz once you start.',
    'You are allowed 2 attempts. The highest score will be recorded.',
    'Ensure you have a stable internet connection before beginning.',
  ],
  questionCount: 10,
  timeLimitMinutes: 30,
  allowedAttempts: 2,
  gradingPolicy: 'Highest score will be recorded',
  courseId: 'crs001',
  courseTitle: 'Introduction to Python Programming',
};

const placeholderAttemptSummary: QuizAttemptSummary = {
  attemptsTaken: 0,
  lastScore: null,
  canViewResults: false,
  canRetake: true,
};

const QuizStartPage = () => {
  const params = useParams();
  const router = useRouter();
  const authContext = useContext(AuthContext);
  const courseId = params.courseId as string;
  const quizId = params.quizId as string;

  const [quizDetails, setQuizDetails] = useState<QuizDetails | null>(null);
  const [attemptSummary, setAttemptSummary] = useState<QuizAttemptSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId || !quizId || !authContext?.token) return;

    const fetchQuizInfo = async () => {
      setLoading(true);
      setError(null);
      try {
        // TODO: API Call 1: Fetch quiz details (GET /api/courses/{courseId}/quizzes/{quizId})
        // const quizDetailsRes = await fetch(`/api/courses/${courseId}/quizzes/${quizId}`, { headers: { 'Authorization': `Bearer ${authContext.token}` }});
        // if (!quizDetailsRes.ok) throw new Error('Failed to fetch quiz details.');
        // const detailsData = await quizDetailsRes.json();
        // setQuizDetails(detailsData);
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
        setQuizDetails({...placeholderQuizDetails, id: quizId, courseId: courseId });

        // TODO: API Call 2: Fetch student's attempt summary for this quiz (GET /api/students/me/quizzes/{quizId}/attempts_summary)
        // const attemptSummaryRes = await fetch(`/api/students/me/quizzes/${quizId}/attempts_summary`, { headers: { 'Authorization': `Bearer ${authContext.token}` }});
        // if (!attemptSummaryRes.ok) throw new Error('Failed to fetch attempt summary.');
        // const summaryData = await attemptSummaryRes.json();
        // setAttemptSummary(summaryData);
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
        setAttemptSummary(placeholderAttemptSummary);

      } catch (err: any) {
        setError(err.message || 'An error occurred while loading quiz information.');
      } finally {
        setLoading(false);
      }
    };

    fetchQuizInfo();
  }, [courseId, quizId, authContext?.token]);

  const handleStartOrRetakeQuiz = async () => {
    if (!quizDetails || !attemptSummary) return;

    // TODO: API Call: Start a new attempt (POST /api/courses/{courseId}/quizzes/{quizId}/attempts)
    // This API should return the new attemptId or direct to the quiz taking page.
    console.log(`Starting/Retaking quiz: ${quizId} for course: ${courseId}`);
    // const response = await fetch(`/api/courses/${courseId}/quizzes/${quizId}/attempts`, { 
    //   method: 'POST', 
    //   headers: { 'Authorization': `Bearer ${authContext?.token}` }
    // });
    // if (!response.ok) { /* handle error */ return; }
    // const newAttemptData = await response.json();
    // router.push(`/courses/${courseId}/quizzes/${quizId}/take?attemptId=${newAttemptData.attemptId}`);
    router.push(`/courses/${courseId}/quizzes/${quizId}/take?attemptId=atmpt_new`); // Placeholder navigation
  };

  if (loading) return <div className="text-center py-20">Loading quiz information...</div>;
  if (error) return <div className="text-center py-20 text-red-500">Error: {error}</div>;
  if (!quizDetails || !attemptSummary) return <div className="text-center py-20">Quiz information not found.</div>;

  const attemptsRemaining = quizDetails.allowedAttempts - attemptSummary.attemptsTaken;
  const canStartNewAttempt = attemptsRemaining > 0;

  let actionButtonLabel = 'Start Quiz';
  let actionButtonDisabled = !canStartNewAttempt;

  if (attemptSummary.attemptsTaken > 0 && canStartNewAttempt) {
    actionButtonLabel = 'Retake Quiz';
  }
  if (attemptSummary.attemptsTaken > 0 && !canStartNewAttempt && attemptSummary.canViewResults) {
    actionButtonLabel = 'View Last Results';
    // Modify handleStartOrRetakeQuiz or add new handler for this case
  }
  if (!canStartNewAttempt && !attemptSummary.canViewResults) {
      actionButtonLabel = 'No Attempts Remaining';
  }


  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <nav aria-label="breadcrumb" className="mb-6 text-sm text-gray-600">
        <ol className="list-none p-0 inline-flex">
          <li className="flex items-center">
            <Link href={`/courses/${quizDetails.courseId}`} legacyBehavior><a className="hover:underline">{quizDetails.courseTitle}</a></Link>
          </li>
          {/* TODO: Add Module/Lesson breadcrumbs if applicable */}
          <li className="flex items-center mx-2">/</li>
          <li className="flex items-center text-gray-800 font-semibold">
            Quiz
          </li>
        </ol>
      </nav>

      <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">{quizDetails.title}</h1>
      <p className="text-gray-700 mb-6 leading-relaxed">{quizDetails.description}</p>

      <div className="bg-white shadow-lg rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-semibold text-gray-700 mb-3">Instructions</h2>
        <ul className="list-disc list-inside space-y-1 text-gray-600 mb-6">
          {quizDetails.instructions.map((inst, index) => (
            <li key={index}>{inst}</li>
          ))}
        </ul>

        <h2 className="text-2xl font-semibold text-gray-700 mb-3">Quiz Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-gray-600">
          <p><strong>Number of Questions:</strong> {quizDetails.questionCount}</p>
          <p><strong>Time Limit:</strong> {quizDetails.timeLimitMinutes ? `${quizDetails.timeLimitMinutes} minutes` : 'No time limit'}</p>
          <p><strong>Allowed Attempts:</strong> {quizDetails.allowedAttempts}</p>
          <p><strong>Attempts Taken:</strong> {attemptSummary.attemptsTaken}</p>
          <p><strong>Attempts Remaining:</strong> {attemptsRemaining > 0 ? attemptsRemaining : 0}</p>
          <p><strong>Grading Policy:</strong> {quizDetails.gradingPolicy}</p>
        </div>
        {attemptSummary.lastScore !== null && attemptSummary.attemptsTaken > 0 && (
            <p className="mt-3 text-gray-600"><strong>Score on Last Attempt:</strong> {attemptSummary.lastScore}%</p>
        )}
      </div>

      <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
        <button
          onClick={handleStartOrRetakeQuiz}
          disabled={actionButtonDisabled}
          className={`w-full sm:w-auto text-white font-semibold py-3 px-8 rounded-lg shadow-md transition duration-150 ease-in-out 
            ${actionButtonDisabled 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-300'}`}
        >
          {actionButtonLabel}
        </button>
        {attemptSummary.attemptsTaken > 0 && attemptSummary.canViewResults && actionButtonLabel !== 'View Last Results' && (
          <Link href={`/courses/${courseId}/quizzes/${quizId}/results/atmpt_last`} legacyBehavior> 
            {/* Replace atmpt_last with actual last attempt ID */}
            <a className="w-full sm:w-auto text-center text-blue-600 hover:text-blue-700 font-semibold py-3 px-8 rounded-lg border border-blue-600 hover:bg-blue-50 transition duration-150">
              View Last Results
            </a>
          </Link>
        )}
        <Link href={`/courses/${courseId}`} legacyBehavior>
            <a className="w-full sm:w-auto text-center text-gray-700 hover:text-gray-900 font-medium py-3 px-6 rounded-lg hover:bg-gray-100 transition duration-150">
                Back to Course
            </a>
        </Link>
      </div>
    </div>
  );
};

export default QuizStartPage;

