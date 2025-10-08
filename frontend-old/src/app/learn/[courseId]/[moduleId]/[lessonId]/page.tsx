'use client';
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { CourseService } from '@/services/course.service';
import { Lesson } from '@/types/api';

// Remove local interface as we're using the one from types

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api/v1";

// Basic UI components (replace with your actual UI library, e.g., shadcn/ui)
const Button = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 text-white bg-indigo-600 hover:bg-indigo-700 ${props.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
  />
);

const LessonPage: React.FC = () => {
  const params = useParams();
  const courseId = params?.courseId as string;
  const moduleId = params?.moduleId as string; // Assuming moduleId is part of the route
  const lessonId = params?.lessonId as string;
  const { token } = useAuth();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId || !moduleId || !lessonId) {
      setError("Missing course, module, or lesson information.");
      setIsLoading(false);
      return;
    }

    const fetchLessonDetail = async () => {
      setIsLoading(true);
      setError(null);
      setCompletionMessage(null);
      try {
        const data = await CourseService.getLesson(Number(lessonId));
        setLesson(data);
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchLessonDetail();
  }, [courseId, moduleId, lessonId, token]);

  const handleMarkAsComplete = async () => {
    if (!lesson || !token) return;
    setIsCompleting(true);
    setCompletionMessage(null);
    try {
      // API endpoint to mark lesson as complete
      // Example: POST /api/v1/lessons/:lessonId/complete
      const response = await fetch(`${API_URL}/lessons/${lesson.id}/complete`, { // Fictional endpoint
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        // body: JSON.stringify({ course_id: courseId, module_id: moduleId }) // if needed
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to mark as complete." }));
        throw new Error(errorData.message || "Failed to mark as complete.");
      }
      setLesson(prev => prev ? { ...prev, is_completed_by_user: true } : null);
      setCompletionMessage("Lesson marked as complete!");
    } catch (err: any) {
      setCompletionMessage(err.message || "Error marking as complete.");
    } finally {
      setIsCompleting(false);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-center">Loading lesson...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-600">Error: {error}</div>;
  }

  if (!lesson) {
    return <div className="p-6 text-center">Lesson data not available.</div>;
  }

  const renderLessonContent = () => {
    switch (lesson.content_type) {
      case "text":
        return <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: lesson.content || "" }} />;
      case "video":
        // Basic video embed, consider using a library for more robust video player
        return (
          <div className="aspect-w-16 aspect-h-9">
            <iframe
              src={lesson.content} // Assuming content is the video URL (e.g., YouTube embed URL)
              title={lesson.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            ></iframe>
          </div>
        );
      case "quiz":
        return (
          <div>
            <h3 className="text-xl font-semibold mb-4">Quiz: {lesson.title}</h3>
            <p className="mb-4">{lesson.content}</p> {/* Or quiz description */}
            {/* Placeholder for Quiz Component */}
            <div className="p-4 border rounded-md bg-yellow-50 text-yellow-700">
              Quiz interaction will be implemented here. (e.g., using a Quiz component that fetches questions for quiz_id: {lesson.id})
            </div>
          </div>
        );
      default:
        return <p>Unsupported lesson content type.</p>;
    }
  };

  return (
    <div className="bg-white p-6 shadow rounded-lg">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{lesson.title}</h1>
      <hr className="my-4" />
      
      <div className="mb-6">
        {renderLessonContent()}
      </div>

      <div className="mt-8 pt-6 border-t">
        {!lesson.is_completed_by_user && (
          <Button onClick={handleMarkAsComplete} disabled={isCompleting}>
            {isCompleting ? "Processing..." : "Mark as Complete"}
          </Button>
        )}
        {lesson.is_completed_by_user && (
            <p className="text-green-600 font-semibold">Lesson Completed!</p>
        )}
        {completionMessage && (
          <p className={`mt-2 text-sm ${completionMessage.includes("Error") || completionMessage.includes("Failed") ? "text-red-600" : "text-green-600"}`}>
            {completionMessage}
          </p>
        )}
      </div>
      
      {/* Basic Next/Previous Lesson Navigation (logic to be implemented) */}
      <div className="mt-8 flex justify-between">
        <Button disabled>Previous Lesson</Button>
        <Button disabled>Next Lesson</Button>
      </div>
    </div>
  );
};

export default LessonPage;

