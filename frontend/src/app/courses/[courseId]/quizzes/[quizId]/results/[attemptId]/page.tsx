"use client";

import React, { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AuthContext } from '@/contexts/AuthContext';

// Placeholder Types - align with lms_phase3_quiz_design.md
interface QuizResultDetails {
  quizId: string;
  quizTitle: string;
  attemptId: string;
  studentName: string; // Or fetch from AuthContext
  attemptDate: string; // ISO Date string
  overallScore: number; // Percentage or points
  totalPossibleScore: number;
  status: 'Graded' | 'Pending Manual Review';
  questions: Array<{
    id: string;
    questionNumber: number;
    text: string;
    studentAnswerText?: string; // For essay/short answer
    studentSelectedOptionIds?: string[];
    studentSelectedOptionId?: string;
    correctOptionIds?: string[];
    correctOptionId?: string;
    isCorrect?: boolean;
    feedback?: string; // Specific to this question for this attempt
    pointsAwarded: number;
    pointsPossible: number;
    options?: Array<{ id: string; text: string }>;
  }>;
  generalFeedback?: string;
  canRetake: boolean;
  courseId: string;
  courseTitle: string;
}

// Placeholder Data
const placeholderQuizResults: QuizResultDetails = {
  quizId: 'q123',
  quizTitle: 'Chapter 1 Review Quiz',
  attemptId: 'atmpt_new', // This would be dynamic
  studentName: 'John Doe',
  attemptDate: new Date().toISOString(),
  overallScore: 85,
  totalPossibleScore: 100,
  status: 'Graded',
  courseId: 'crs001',
  courseTitle: 'Introduction to Python Programming',
  questions: [
    {
      id: 'q1',
      questionNumber: 1,
      text: 'What is the primary purpose of a variable in programming?',
      studentSelectedOptionId: 'q1opt1',
      correctOptionId: 'q1opt1',
      isCorrect: true,
      pointsAwarded: 10,
      pointsPossible: 10,
      options: [
        { id: 'q1opt1', text: 'To store data that can change' },
        { id: 'q1opt2', text: 'To perform calculations' },
      ],
      feedback: 'Correct! Variables are fundamental for storing and managing data.'
    },
    {
      id: 'q2',
      questionNumber: 2,
      text: 'Select all primitive data types in JavaScript.',
      studentSelectedOptionIds: ['q2opt1', 'q2opt2'], // Missed 'q2opt5'
      correctOptionIds: ['q2opt1', 'q2opt2', 'q2opt5'],
      isCorrect: false,
      pointsAwarded: 5, // Partial credit example
      pointsPossible: 10,
      options: [
        { id: 'q2opt1', text: 'String' },
        { id: 'q2opt2', text: 'Number' },
        { id: 'q2opt3', text: 'Array' },
        { id: 'q2opt4', text: 'Object' },
        { id: 'q2opt5', text: 'Boolean' },
      ],
      feedback: 'You missed one of the primitive types. Arrays and Objects are not primitive types.'
    },
    {
      id: 'q4',
      questionNumber: 3, // Assuming q3 was True/False and also correct
      text: 'Briefly explain the concept of a loop.',
      studentAnswerText: 'A loop is used to repeat a block of code multiple times.',
      isCorrect: true, // Assuming auto-graded or manually graded as correct
      pointsAwarded: 15,
      pointsPossible: 15,
      feedback: 'Good explanation! Loops are essential for iteration.'
    },
    {
      id: 'q5',
      questionNumber: 4,
      text: 'Describe a real-world scenario where Object-Oriented Programming principles can be applied. Explain which principles are relevant and how.',
      studentAnswerText: 'Building a simulation of a city. Objects like cars, buildings, and people can be modeled. Encapsulation for internal state, Inheritance for different types of vehicles, Polymorphism for actions like move().',
      // For essays, isCorrect might be null until manually graded, or based on keyword matching if auto-graded
      status: 'Pending Manual Review', // Example for an essay question
      pointsAwarded: 0, // Or partial if some auto-grading happened
      pointsPossible: 20,
      feedback: 'Submitted for manual grading.'
    }
  ],
  generalFeedback: 'Overall, a good attempt! Review the material on JavaScript primitive types.',
  canRetake: true, // Assuming they have attempts left
};

const QuizResultsPage = () => {
  const params = useParams();
  const router = useRouter();
  const authContext = useContext(AuthContext);

  const courseId = params.courseId as string;
  const quizId = params.quizId as string;
  const attemptId = params.attemptId as string;

  const [results, setResults] = useState<QuizResultDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId || !quizId || !attemptId || !authContext?.user) {
        setError("Missing required parameters or user not logged in.");
        setLoading(false);
        return;
    }

    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      try {
        // TODO: API Call: Fetch quiz results (GET /api/courses/{courseId}/quizzes/{quizId}/attempts/{attemptId}/results)
        // const response = await fetch(`/api/courses/${courseId}/quizzes/${quizId}/attempts/${attemptId}/results`, {
        //   headers: { 'Authorization': `Bearer ${authContext.token}` }
        // });
        // if (!response.ok) throw new Error('Failed to load quiz results.');
        // const data = await response.json();
        // setResults(data);
        await new Promise(resolve => setTimeout(resolve, 700)); // Simulate API delay
        setResults({...placeholderQuizResults, attemptId, quizId, courseId, studentName: `${authContext.user.firstName} ${authContext.user.lastName}` });
      } catch (err: any) {
        setError(err.message || 'An error occurred while loading quiz results.');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [courseId, quizId, attemptId, authContext?.user, authContext?.token]);

  if (loading) return <div className="text-center py-20">Loading quiz results...</div>;
  if (error) return <div className="text-center py-20 text-red-500">Error: {error}</div>;
  if (!results) return <div className="text-center py-20">Quiz results not found.</div>;

  const getOptionText = (questionId: string, optionId: string): string => {
    const question = results.questions.find(q => q.id === questionId);
    const option = question?.options?.find(opt => opt.id === optionId);
    return option?.text || 'N/A';
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <nav aria-label="breadcrumb" className="mb-6 text-sm text-gray-600">
        <ol className="list-none p-0 inline-flex">
          <li className="flex items-center">
            <Link href={`/courses/${results.courseId}`} legacyBehavior><a className="hover:underline">{results.courseTitle}</a></Link>
          </li>
          <li className="flex items-center mx-2">/</li>
          <li className="flex items-center">
            <Link href={`/courses/${results.courseId}/quizzes/${results.quizId}/start`} legacyBehavior><a className="hover:underline">{results.quizTitle}</a></Link>
          </li>
           <li className="flex items-center mx-2">/</li>
          <li className="flex items-center text-gray-800 font-semibold">
            Results
          </li>
        </ol>
      </nav>

      <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">Quiz Results</h1>
      <p className="text-gray-600 mb-1">For: {results.studentName}</p>
      <p className="text-gray-600 mb-6">Attempt Date: {new Date(results.attemptDate).toLocaleString()}</p>

      <div className="bg-white shadow-xl rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className={`p-4 rounded-lg text-center ${results.overallScore >= 70 ? 'bg-green-100' : 'bg-red-100'}`}>
            <p className="text-lg font-medium text-gray-700">Your Score</p>
            <p className={`text-4xl font-bold ${results.overallScore >= 70 ? 'text-green-700' : 'text-red-700'}`}>
              {results.overallScore}% 
              <span className="text-2xl text-gray-600">({results.questions.reduce((sum, q) => sum + q.pointsAwarded, 0)} / {results.totalPossibleScore} pts)</span>
            </p>
          </div>
          <div className="p-4 rounded-lg bg-blue-100 text-center">
            <p className="text-lg font-medium text-gray-700">Status</p>
            <p className="text-3xl font-bold text-blue-700">{results.status}</p>
          </div>
        </div>
        {results.generalFeedback && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <h3 className="font-semibold text-yellow-800">Overall Feedback:</h3>
            <p className="text-yellow-700">{results.generalFeedback}</p>
          </div>
        )}
      </div>

      <div className="bg-white shadow-xl rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-semibold text-gray-700 mb-6">Question Breakdown</h2>
        {results.questions.map((q, index) => (
          <div key={q.id} className={`py-6 ${index < results.questions.length - 1 ? 'border-b border-gray-200' : ''}`}>
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-semibold text-gray-800">Question {q.questionNumber}</h3>
              <span 
                className={`px-3 py-1 text-sm font-semibold rounded-full 
                  ${q.isCorrect === true ? 'bg-green-100 text-green-700' : 
                    q.isCorrect === false ? 'bg-red-100 text-red-700' : 
                    'bg-yellow-100 text-yellow-700'}`}
              >
                {q.isCorrect === true ? `Correct (${q.pointsAwarded}/${q.pointsPossible} pts)` : 
                 q.isCorrect === false ? `Incorrect (${q.pointsAwarded}/${q.pointsPossible} pts)` : 
                 `Pending Review (${q.pointsAwarded}/${q.pointsPossible} pts)`}
              </span>
            </div>
            <p className="text-gray-700 mb-3 whitespace-pre-wrap">{q.text}</p>
            
            <div className="mb-3 pl-4 border-l-4 
              ${q.isCorrect === true ? 'border-green-500' : q.isCorrect === false ? 'border-red-500' : 'border-yellow-500'}">
              <p className="text-sm font-medium text-gray-600 mb-1">Your Answer:</p>
              {q.studentAnswerText && <p className="text-gray-800 italic whitespace-pre-wrap">{q.studentAnswerText}</p>}
              {q.studentSelectedOptionId && <p className="text-gray-800 italic">{getOptionText(q.id, q.studentSelectedOptionId)}</p>}
              {q.studentSelectedOptionIds && q.studentSelectedOptionIds.length > 0 && (
                <ul className="list-disc list-inside ml-4">
                  {q.studentSelectedOptionIds.map(optId => <li key={optId} className="text-gray-800 italic">{getOptionText(q.id, optId)}</li>)}
                </ul>
              )}
              {(!q.studentAnswerText && !q.studentSelectedOptionId && (!q.studentSelectedOptionIds || q.studentSelectedOptionIds.length === 0)) && 
                <p className="text-gray-500 italic">No answer submitted.</p>}
            </div>

            {q.isCorrect === false && (q.correctOptionId || q.correctOptionIds) && (
              <div className="mb-3 pl-4 border-l-4 border-blue-500">
                <p className="text-sm font-medium text-gray-600 mb-1">Correct Answer:</p>
                {q.correctOptionId && <p className="text-blue-700 italic">{getOptionText(q.id, q.correctOptionId)}</p>}
                {q.correctOptionIds && q.correctOptionIds.length > 0 && (
                  <ul className="list-disc list-inside ml-4">
                    {q.correctOptionIds.map(optId => <li key={optId} className="text-blue-700 italic">{getOptionText(q.id, optId)}</li>)}
                  </ul>
                )}
              </div>
            )}

            {q.feedback && (
              <div className="mt-2 p-3 bg-gray-50 rounded-md">
                <p className="text-sm font-medium text-gray-600 mb-1">Feedback:</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{q.feedback}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
        {results.canRetake && (
          <Link href={`/courses/${results.courseId}/quizzes/${results.quizId}/start`} legacyBehavior>
            <a className="w-full sm:w-auto text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition duration-150">
              Retake Quiz
            </a>
          </Link>
        )}
        <Link href={`/courses/${results.courseId}`} legacyBehavior>
          <a className="w-full sm:w-auto text-center text-gray-700 hover:text-gray-900 font-medium py-3 px-6 rounded-lg border border-gray-300 hover:bg-gray-100 transition duration-150">
            Back to Course
          </a>
        </Link>
      </div>
    </div>
  );
};

export default QuizResultsPage;

