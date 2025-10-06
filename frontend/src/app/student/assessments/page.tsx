'use client';

import { useState, useEffect } from 'react';
import { Clock, FileText, Award, AlertCircle, CheckCircle, XCircle, Calendar, Target } from 'lucide-react';

interface Quiz {
  id: number;
  title: string;
  description: string;
  timeLimit: number;
  passingScore: number;
  maxAttempts: number;
  attemptsUsed: number;
  bestScore?: number;
}

interface Assignment {
  id: number;
  title: string;
  description: string;
  dueDate?: string;
  status: 'pending' | 'submitted' | 'graded';
  score?: number;
  maxScore: number;
}

export default function StudentAssessments() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading assessments data
    setTimeout(() => {
      setQuizzes([
        {
          id: 1,
          title: "React Fundamentals Quiz",
          description: "Test your knowledge of React basics",
          timeLimit: 30,
          passingScore: 70,
          maxAttempts: 3,
          attemptsUsed: 1,
          bestScore: 85
        },
        {
          id: 2,
          title: "JavaScript Advanced Quiz",
          description: "Advanced JavaScript concepts and ES6+",
          timeLimit: 45,
          passingScore: 75,
          maxAttempts: 2,
          attemptsUsed: 0
        }
      ]);
      
      setAssignments([
        {
          id: 1,
          title: "Build a Todo App",
          description: "Create a React todo application with CRUD functionality",
          dueDate: "2025-10-15",
          status: "submitted",
          score: 92,
          maxScore: 100
        },
        {
          id: 2,
          title: "API Integration Project",
          description: "Build a weather app using external API",
          dueDate: "2025-10-20",
          status: "pending",
          maxScore: 100
        }
      ]);
      
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading assessments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Assessments</h1>
          <p className="text-gray-600 mt-2">Complete quizzes and assignments to test your knowledge</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Quizzes Section */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center mb-6">
              <FileText className="h-6 w-6 text-blue-600 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900">Quizzes</h2>
            </div>
            
            <div className="space-y-4">
              {quizzes.map((quiz) => (
                <div key={quiz.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-gray-900">{quiz.title}</h3>
                    {quiz.bestScore && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Best: {quiz.bestScore}%
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{quiz.description}</p>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {quiz.timeLimit} minutes
                    </div>
                    <div className="flex items-center">
                      <Target className="h-4 w-4 mr-1" />
                      Pass: {quiz.passingScore}%
                    </div>
                    <div>
                      Attempts: {quiz.attemptsUsed}/{quiz.maxAttempts}
                    </div>
                  </div>
                  
                  <button 
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                    disabled={quiz.attemptsUsed >= quiz.maxAttempts}
                  >
                    {quiz.attemptsUsed >= quiz.maxAttempts ? 'No attempts left' : 
                     quiz.attemptsUsed > 0 ? 'Retake Quiz' : 'Start Quiz'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Assignments Section */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center mb-6">
              <Award className="h-6 w-6 text-purple-600 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900">Assignments</h2>
            </div>
            
            <div className="space-y-4">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-gray-900">{assignment.title}</h3>
                    {assignment.status === 'submitted' && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    {assignment.status === 'pending' && (
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    )}
                    {assignment.status === 'graded' && (
                      <Award className="h-5 w-5 text-blue-500" />
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{assignment.description}</p>
                  
                  {assignment.dueDate && (
                    <div className="flex items-center text-sm text-gray-500 mb-3">
                      <Calendar className="h-4 w-4 mr-1" />
                      Due: {new Date(assignment.dueDate).toLocaleDateString()}
                    </div>
                  )}
                  
                  {assignment.score !== undefined && (
                    <div className="mb-3">
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Score</span>
                        <span>{assignment.score}/{assignment.maxScore}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${(assignment.score / assignment.maxScore) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  <button 
                    className={`w-full py-2 px-4 rounded-md transition-colors ${
                      assignment.status === 'submitted' 
                        ? 'bg-green-100 text-green-700 cursor-default' 
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                    disabled={assignment.status === 'submitted'}
                  >
                    {assignment.status === 'submitted' ? 'Submitted' : 'Start Assignment'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}