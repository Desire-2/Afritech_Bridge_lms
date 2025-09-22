"use client";

import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AuthContext } from '@/contexts/AuthContext';

// Placeholder Types - align with lms_phase3_quiz_design.md
interface Question {
  id: string;
  questionNumber: number;
  text: string;
  type: 'MCQ_SINGLE' | 'MCQ_MULTI' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'ESSAY';
  points: number;
  options?: Array<{ id: string; text: string }>;
  imageUrl?: string;
}

interface StudentAnswer {
  questionId: string;
  selectedOptionIds?: string[]; // For MCQ_MULTI
  selectedOptionId?: string; // For MCQ_SINGLE, TRUE_FALSE
  textAnswer?: string; // For SHORT_ANSWER, ESSAY
}

interface QuizSessionData {
  quizTitle: string;
  questions: Question[];
  timeLimitMinutes: number | null;
  attemptId: string;
  startTime?: number; // Timestamp when quiz started (if timed)
}

// Placeholder Data
const placeholderQuizSession: QuizSessionData = {
  quizTitle: 'Chapter 1 Review Quiz',
  attemptId: 'atmpt_new',
  timeLimitMinutes: 30,
  questions: [
    {
      id: 'q1',
      questionNumber: 1,
      text: 'What is the primary purpose of a variable in programming?',
      type: 'MCQ_SINGLE',
      points: 10,
      options: [
        { id: 'q1opt1', text: 'To store data that can change' },
        { id: 'q1opt2', text: 'To perform calculations' },
        { id: 'q1opt3', text: 'To define the structure of a program' },
        { id: 'q1opt4', text: 'To print output to the console' },
      ],
    },
    {
      id: 'q2',
      questionNumber: 2,
      text: 'Select all primitive data types in JavaScript.',
      type: 'MCQ_MULTI',
      points: 10,
      options: [
        { id: 'q2opt1', text: 'String' },
        { id: 'q2opt2', text: 'Number' },
        { id: 'q2opt3', text: 'Array' },
        { id: 'q2opt4', text: 'Object' },
        { id: 'q2opt5', text: 'Boolean' },
      ],
    },
    {
      id: 'q3',
      questionNumber: 3,
      text: 'A boolean variable can only hold two values: true or false.',
      type: 'TRUE_FALSE',
      points: 5,
      options: [
        { id: 'q3opt1', text: 'True' },
        { id: 'q3opt2', text: 'False' },
      ],
    },
    {
      id: 'q4',
      questionNumber: 4,
      text: 'Briefly explain the concept of a loop.',
      type: 'SHORT_ANSWER',
      points: 15,
    },
    {
      id: 'q5',
      questionNumber: 5,
      text: 'Describe a real-world scenario where Object-Oriented Programming principles can be applied. Explain which principles are relevant and how.',
      type: 'ESSAY',
      points: 20,
    },
  ],
};

const QuizTakingPage = () => {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const authContext = useContext(AuthContext);

  const courseId = params.courseId as string;
  const quizId = params.quizId as string;
  const attemptId = searchParams.get('attemptId');

  const [quizSession, setQuizSession] = useState<QuizSessionData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, StudentAnswer>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null); // in seconds
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch quiz questions and attempt details
  useEffect(() => {
    if (!courseId || !quizId || !attemptId || !authContext?.token) {
      setError("Missing required parameters or authentication.");
      setLoading(false);
      return;
    }

    const fetchQuizData = async () => {
      setLoading(true);
      setError(null);
      try {
        // TODO: API Call: Fetch quiz questions and attempt details (e.g., GET /api/courses/{courseId}/quizzes/{quizId}/attempts/{attemptId}/take)
        // This API should return quiz title, questions, time limit, and start time if already started.
        // const response = await fetch(`/api/courses/${courseId}/quizzes/${quizId}/attempts/${attemptId}/take`, { 
        //   headers: { 'Authorization': `Bearer ${authContext.token}` }
        // });
        // if (!response.ok) throw new Error('Failed to load quiz data.');
        // const data = await response.json();
        // setQuizSession(data);
        // if(data.timeLimitMinutes && data.startTime) {
        //    const elapsedSeconds = Math.floor((Date.now() - new Date(data.startTime).getTime()) / 1000);
        //    setTimeLeft(data.timeLimitMinutes * 60 - elapsedSeconds);
        // } else if (data.timeLimitMinutes) {
        //    setTimeLeft(data.timeLimitMinutes * 60);
        //    // Potentially an API call here to mark the quiz as started and get the official server start time
        // }
        await new Promise(resolve => setTimeout(resolve, 700)); // Simulate API delay
        const sessionData = {...placeholderQuizSession, attemptId: attemptId, quizTitle: `Quiz ${quizId} - Attempt ${attemptId}`};
        setQuizSession(sessionData);
        if (sessionData.timeLimitMinutes) {
          setTimeLeft(sessionData.timeLimitMinutes * 60);
          // Here, you might also record the actual start time on the server via an API call if this is the first load.
        }

        // TODO: API Call: Fetch any previously saved answers for this attempt (if resuming)
        // const savedAnswersRes = await fetch(`/api/attempts/${attemptId}/answers`, { headers: { 'Authorization': `Bearer ${authContext.token}` }});
        // if (savedAnswersRes.ok) { const savedData = await savedAnswersRes.json(); setAnswers(savedData); }

      } catch (err: any) {
        setError(err.message || 'An error occurred while loading the quiz.');
      } finally {
        setLoading(false);
      }
    };
    fetchQuizData();
  }, [courseId, quizId, attemptId, authContext?.token]);

  // Timer logic
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || submitting) return;
    const timerId = setInterval(() => {
      setTimeLeft(prevTime => {
        if (prevTime !== null && prevTime <= 1) {
          clearInterval(timerId);
          handleAutoSubmit();
          return 0;
        }
        return prevTime !== null ? prevTime - 1 : null;
      });
    }, 1000);
    return () => clearInterval(timerId);
  }, [timeLeft, submitting]);

  const handleAutoSubmit = () => {
    console.log("Time is up! Auto-submitting quiz.");
    handleSubmitQuiz(true); // true indicates auto-submission
  };

  const handleAnswerChange = useCallback((questionId: string, answer: Partial<StudentAnswer>) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { ...(prev[questionId] || { questionId }), ...answer },
    }));
    // TODO: API Call (Optional): Auto-save answer (PUT /api/attempts/{attemptId}/answers/{questionId})
    // console.log("Answer for", questionId, "updated:", answer);
  }, []);

  const navigateQuestion = (index: number) => {
    if (quizSession && index >= 0 && index < quizSession.questions.length) {
      setCurrentQuestionIndex(index);
    }
  };

  const handleSubmitQuiz = async (isAutoSubmit = false) => {
    if (submitting) return;
    setSubmitting(true);

    const confirmSubmit = isAutoSubmit ? true : window.confirm("Are you sure you want to submit your quiz?");
    if (!confirmSubmit) {
      setSubmitting(false);
      return;
    }

    console.log("Submitting quiz with answers:", answers);
    try {
      // TODO: API Call: Submit all answers (POST /api/attempts/{attemptId}/submit)
      // const response = await fetch(`/api/attempts/${attemptId}/submit`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authContext?.token}` },
      //   body: JSON.stringify({ answers: Object.values(answers) }),
      // });
      // if (!response.ok) throw new Error('Failed to submit quiz.');
      // const resultData = await response.json(); // May contain submission ID or immediate results info
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate submission delay
      router.push(`/courses/${courseId}/quizzes/${quizId}/results/${attemptId}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred during submission.');
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-20">Loading quiz...</div>;
  if (error) return <div className="text-center py-20 text-red-500">Error: {error}</div>;
  if (!quizSession) return <div className="text-center py-20">Could not load quiz session.</div>;

  const currentQuestion = quizSession.questions[currentQuestionIndex];
  const formatTime = (seconds: number | null) => {
    if (seconds === null) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderQuestionOptions = (q: Question) => {
    const currentAnswer = answers[q.id] || {};
    switch (q.type) {
      case 'MCQ_SINGLE':
        return q.options?.map(opt => (
          <div key={opt.id} className="mb-2">
            <label className="flex items-center p-3 border rounded-md hover:bg-gray-50 cursor-pointer">
              <input 
                type="radio" 
                name={q.id} 
                value={opt.id} 
                checked={currentAnswer.selectedOptionId === opt.id}
                onChange={() => handleAnswerChange(q.id, { selectedOptionId: opt.id })}
                className="mr-3 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              {opt.text}
            </label>
          </div>
        ));
      case 'MCQ_MULTI':
        return q.options?.map(opt => (
          <div key={opt.id} className="mb-2">
            <label className="flex items-center p-3 border rounded-md hover:bg-gray-50 cursor-pointer">
              <input 
                type="checkbox" 
                name={q.id} 
                value={opt.id} 
                checked={currentAnswer.selectedOptionIds?.includes(opt.id) || false}
                onChange={(e) => {
                  const newSelection = [...(currentAnswer.selectedOptionIds || [])];
                  if (e.target.checked) {
                    newSelection.push(opt.id);
                  } else {
                    const index = newSelection.indexOf(opt.id);
                    if (index > -1) newSelection.splice(index, 1);
                  }
                  handleAnswerChange(q.id, { selectedOptionIds: newSelection });
                }}
                className="mr-3 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              {opt.text}
            </label>
          </div>
        ));
      case 'TRUE_FALSE':
        return q.options?.map(opt => (
          <div key={opt.id} className="mb-2">
            <label className="flex items-center p-3 border rounded-md hover:bg-gray-50 cursor-pointer">
              <input 
                type="radio" 
                name={q.id} 
                value={opt.id} 
                checked={currentAnswer.selectedOptionId === opt.id}
                onChange={() => handleAnswerChange(q.id, { selectedOptionId: opt.id })}
                className="mr-3 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              {opt.text}
            </label>
          </div>
        ));
      case 'SHORT_ANSWER':
        return (
          <input 
            type="text" 
            value={currentAnswer.textAnswer || ''}
            onChange={(e) => handleAnswerChange(q.id, { textAnswer: e.target.value })}
            className="w-full p-3 border rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="Type your answer here"
          />
        );
      case 'ESSAY':
        return (
          <textarea 
            value={currentAnswer.textAnswer || ''}
            onChange={(e) => handleAnswerChange(q.id, { textAnswer: e.target.value })}
            rows={8}
            className="w-full p-3 border rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="Type your essay here"
          />
        );
      default: return <p>Unsupported question type.</p>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-md p-4 sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl md:text-2xl font-semibold text-gray-800 truncate" title={quizSession.quizTitle}>{quizSession.quizTitle}</h1>
          {quizSession.timeLimitMinutes && (
            <div className={`text-lg font-bold p-2 rounded-md ${timeLeft !== null && timeLeft < 600 ? 'text-red-600' : 'text-gray-700'}`}>
              Time Left: {formatTime(timeLeft)}
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="container mx-auto flex-grow p-4 md:p-6 flex flex-col lg:flex-row gap-6">
        {/* Question Navigation Panel (Sidebar) */}
        <aside className="w-full lg:w-1/4 bg-white p-4 rounded-lg shadow-lg h-fit lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold mb-3 text-gray-700">Questions ({quizSession.questions.length})</h2>
          <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-5 gap-2">
            {quizSession.questions.map((q, index) => (
              <button 
                key={q.id} 
                onClick={() => navigateQuestion(index)}
                className={`p-2 border rounded-md text-sm font-medium transition-colors
                  ${index === currentQuestionIndex ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 
                  (answers[q.id] ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700')}`}
              >
                {q.questionNumber}
              </button>
            ))}
          </div>
        </aside>

        {/* Question Display Area */}
        <section className="w-full lg:w-3/4 bg-white p-6 rounded-lg shadow-lg">
          {currentQuestion && (
            <div>
              <div className="mb-4 flex justify-between items-baseline">
                <h2 className="text-xl font-semibold text-gray-800">Question {currentQuestion.questionNumber}</h2>
                <span className="text-sm text-gray-500">({currentQuestion.points} points)</span>
              </div>
              {currentQuestion.imageUrl && (
                <img src={currentQuestion.imageUrl} alt={`Question ${currentQuestion.questionNumber} image`} className="mb-4 max-w-full h-auto rounded-md"/>
              )}
              <p className="text-gray-700 mb-6 text-lg leading-relaxed whitespace-pre-wrap">{currentQuestion.text}</p>
              <div>{renderQuestionOptions(currentQuestion)}</div>
            </div>
          )}
        </section>
      </main>

      {/* Footer Controls */}
      <footer className="bg-white shadow-top p-4 sticky bottom-0 z-10">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <button 
            onClick={() => navigateQuestion(currentQuestionIndex - 1)}
            disabled={currentQuestionIndex === 0 || submitting}
            className="w-full sm:w-auto px-6 py-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Previous
          </button>
          {currentQuestionIndex < quizSession.questions.length - 1 ? (
            <button 
              onClick={() => navigateQuestion(currentQuestionIndex + 1)}
              disabled={submitting}
              className="w-full sm:w-auto px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Next
            </button>
          ) : (
            <button 
              onClick={() => handleSubmitQuiz(false)}
              disabled={submitting}
              className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {submitting ? 'Submitting...' : 'Submit Quiz'}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};

export default QuizTakingPage;

