'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedLayout from "@/app/dashboard/layout"; // Assuming layout is in app/dashboard
import { CourseService } from '@/services/course.service';
import { Course } from '@/types/api';

// Basic UI components (replace with your actual UI library, e.g., shadcn/ui)
const CourseCard: React.FC<{ course: Course }> = ({ course }) => (
  <div className="bg-white shadow overflow-hidden sm:rounded-lg">
    <div className="px-4 py-5 sm:px-6">
      {/* Add course image here if available */}
      <h3 className="text-lg leading-6 font-medium text-gray-900">
        <Link href={`/courses/${course.id}`} className="hover:text-indigo-600">
          {course.title}
        </Link>
      </h3>
      <p className="mt-1 max-w-2xl text-sm text-gray-500">
        {/* Instructor: {course.instructor_name || 'N/A'} */}
      </p>
    </div>
    <div className="border-t border-gray-200 px-4 py-4 sm:px-6">
      <p className="text-sm text-gray-700 line-clamp-3">{course.description}</p>
      <div className="mt-4">
        <Link href={`/courses/${course.id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          View Details &rarr;
        </Link>
      </div>
    </div>
  </div>
);

const CoursesPage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const coursesData = await CourseService.getAllCourses();
        setCourses(coursesData);
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCourses();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading courses...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-600">
        <p>Error: {error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <ProtectedLayout>
    <div className="bg-gray-100 min-h-screen">
      {/* You would typically have a global Layout component here for Header, Footer, etc. */}
      {/* <Header /> */}
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
              Explore Our Courses
            </h1>
            <p className="mt-5 max-w-xl mx-auto text-xl text-gray-500">
              Start learning and unlock your potential with our wide range of coding courses.
            </p>
          </div>

          {/* Add Filters and Search Bar here later */}

          {courses.length === 0 ? (
            <div className="mt-12 text-center">
              <p className="text-lg text-gray-600">No courses available at the moment. Please check back later.</p>
            </div>
          ) : (
            <div className="mt-12 max-w-lg mx-auto grid gap-5 lg:grid-cols-3 lg:max-w-none">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
        </div>
      </main>
      {/* <Footer /> */}
    </div>
    </ProtectedLayout>
  );
};

export default CoursesPage;

