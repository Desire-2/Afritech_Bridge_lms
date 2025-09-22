'use client';
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation"; // For accessing route parameters
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext"; // To get user and token for enrollment

// Define the shape of a course object (can be more detailed)
interface Course {
  id: number;
  title: string;
  description: string;
  long_description?: string; // Assuming a more detailed description field
  instructor_id: number;
  instructor_name?: string; // Example
  modules?: Module[]; // If modules are part of course detail
  // Add other course properties like cover_image_url, category, learning_objectives, etc.
}

interface Module {
  id: number;
  title: string;
  description?: string;
  lessons?: Lesson[];
}

interface Lesson {
  id: number;
  title: string;
  content_type?: string; // e.g., text, video, quiz
}

// API base URL - should be in an environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api/v1";

// Basic UI components (replace with your actual UI library, e.g., shadcn/ui)
const Button = (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) => (
  <button
    {...props}
    className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
      props.variant === "secondary"
        ? "text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
        : "text-white bg-indigo-600 hover:bg-indigo-700"
    } ${props.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
  />
);

const CourseDetailPage: React.FC = () => {
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentMessage, setEnrollmentMessage] = useState<string | null>(null);
  const params = useParams();
  const courseId = params?.courseId; // courseId comes from the folder name [courseId]
  const { user, token } = useAuth();

  useEffect(() => {
    if (!courseId) {
      setError("Course ID is missing.");
      setIsLoading(false);
      return;
    }

    const fetchCourseDetails = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/courses/${courseId}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Course not found.");
          } else {
            throw new Error("Failed to fetch course details.");
          }
        }
        const data = await response.json();
        setCourse(data); // Assuming API returns the course object directly
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCourseDetails();
  }, [courseId]);

  const handleEnroll = async () => {
    if (!user || !token || !course) {
      setError("You must be logged in to enroll."); // Or redirect to login
      return;
    }
    setIsEnrolling(true);
    setEnrollmentMessage(null);
    try {
      const response = await fetch(`${API_URL}/enrollments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ course_id: course.id }),
      });
      const data = await response.json();
      if (response.ok) {
        setEnrollmentMessage("Successfully enrolled! You can now access the course content.");
        // Optionally, update UI to reflect enrollment status (e.g., disable enroll button)
      } else {
        throw new Error(data.message || "Enrollment failed. You might already be enrolled or an error occurred.");
      }
    } catch (err: any) {
      setEnrollmentMessage(err.message);
    } finally {
      setIsEnrolling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading course details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <p className="text-red-600 text-xl">Error: {error}</p>
        <Link href="/courses" className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
          Back to Courses
        </Link>
      </div>
    );
  }

  if (!course) {
    // This case should ideally be handled by the error state from fetch
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Course not found.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      {/* <Header /> */}
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              {/* Add course image here */}
              <h1 className="text-3xl font-bold text-gray-900">{course.title}</h1>
              <p className="mt-1 text-sm text-gray-500">
                Instructor: {course.instructor_name || "N/A"} {/* Fetch/join instructor name */}
              </p>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-3">Course Description</h2>
              <p className="text-gray-700 whitespace-pre-wrap">
                {course.long_description || course.description}
              </p>

              {/* Display Modules and Lessons if available */}
              {course.modules && course.modules.length > 0 && (
                <div className="mt-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">Course Content</h2>
                  {course.modules.map((module) => (
                    <div key={module.id} className="mb-4 p-4 border rounded-md">
                      <h3 className="text-lg font-medium text-gray-900">{module.title}</h3>
                      {module.description && <p className="text-sm text-gray-600 mt-1">{module.description}</p>}
                      {module.lessons && module.lessons.length > 0 && (
                        <ul className="list-disc list-inside mt-2 pl-4 text-sm text-gray-700">
                          {module.lessons.map((lesson) => (
                            <li key={lesson.id}>{lesson.title}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-8">
                {user ? (
                  <Button onClick={handleEnroll} disabled={isEnrolling || !!enrollmentMessage?.includes("Successfully")}>
                    {isEnrolling ? "Enrolling..." : enrollmentMessage?.includes("Successfully") ? "Enrolled" : "Enroll Now"}
                  </Button>
                ) : (
                  <Link href={`/auth/login?redirect=/courses/${course.id}`}>
                    <Button variant="primary">Login to Enroll</Button>
                  </Link>
                )}
                {enrollmentMessage && (
                  <p className={`mt-3 text-sm ${enrollmentMessage.includes("Successfully") ? "text-green-600" : "text-red-600"}`}>
                    {enrollmentMessage}
                  </p>
                )}
              </div>

              <div className="mt-6">
                <Link href="/courses" className="text-indigo-600 hover:text-indigo-500">
                  &larr; Back to all courses
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      {/* <Footer /> */}
    </div>
  );
};

export default CourseDetailPage;

