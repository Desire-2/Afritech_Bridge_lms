"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useParams } from 'next/navigation';
import QuizInterface from '@/components/student/QuizInterface';
import { ClientOnly, useIsClient } from '@/lib/hydration-helper';

const QuizPage = () => {
  const { user, isAuthenticated } = useAuth();
  const params = useParams();
  const isClient = useIsClient();
  const quizId = params?.quizId as string;

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Please log in to take quizzes.</p>
        </div>
      </div>
    );
  }

  if (!quizId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Quiz Not Found</h2>
          <p className="text-muted-foreground">Invalid quiz ID provided.</p>
        </div>
      </div>
    );
  }

  return (
    <ClientOnly>
      <div className="min-h-screen bg-background">
        <QuizInterface 
          quizId={parseInt(quizId)} 
          onComplete={(results) => {
            console.log('Quiz completed:', results);
            // You can add navigation or feedback here
          }}
        />
      </div>
    </ClientOnly>
  );
};

export default QuizPage;