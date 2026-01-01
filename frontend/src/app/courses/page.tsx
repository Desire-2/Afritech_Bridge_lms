'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Course } from '@/types/api';
import { CourseApiService } from '@/services/api';

// Public Course Card Component
const PublicCourseCard: React.FC<{ course: Course }> = ({ course }) => (
  <div className="bg-white dark:bg-gray-800 shadow-lg overflow-hidden rounded-xl hover:shadow-2xl transition-all duration-300 border border-gray-200 dark:border-gray-700 h-full flex flex-col">
    {/* Course Header with Gradient */}
    <div className="bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-sm text-white border border-white/30">
            📚 Course
          </span>
          {course.level && (
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-white/20 backdrop-blur-sm text-white">
              {course.level}
            </span>
          )}
        </div>
        <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">
          {course.title}
        </h3>
      </div>
    </div>
    
    {/* Course Content */}
    <div className="px-6 py-5 flex-grow">
      <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-3">
        {course.description || 'No description available'}
      </p>
      
      {/* Course Meta Info */}
      <div className="space-y-2 mb-4">
        {course.instructor_name && (
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="font-medium">Instructor:</span>
            <span className="ml-1">{course.instructor_name}</span>
          </div>
        )}
        {course.estimated_duration && (
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">Duration:</span>
            <span className="ml-1">{course.estimated_duration}</span>
          </div>
        )}
      </div>
    </div>
    
    {/* Action Buttons */}
    <div className="px-6 pb-6 mt-auto">
      <div className="flex gap-3">
        <Link 
          href={`/courses/${course.id}`}
          className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 hover:border-sky-500 dark:hover:border-sky-500 text-gray-700 dark:text-gray-300 hover:text-sky-600 dark:hover:text-sky-400 font-medium rounded-lg transition-all duration-200 text-center text-sm"
        >
          View Details
        </Link>
        <Link 
          href={`/courses/${course.id}/apply`}
          className="flex-1 px-4 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-center text-sm flex items-center justify-center gap-2"
        >
          <span>Apply Now</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </div>
    </div>
  </div>
);

const PublicCoursesPage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCourses = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log('Fetching courses from:', process.env.NEXT_PUBLIC_API_URL);
        // Fetch courses from backend API
        const response = await CourseApiService.getCourses({
          page: 1,
          per_page: 100,
          sort_by: 'recent'
        });
        
        // Handle both array response and paginated response
        const fetchedCourses = Array.isArray(response) 
          ? response 
          : (response.items || []);
        
        console.log('Fetched courses:', fetchedCourses.length, 'courses');
        setCourses(fetchedCourses);
      } catch (err: any) {
        console.error('Error loading courses:', err);
        setError(err.message || 'Failed to load courses. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    loadCourses();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400 mx-auto mb-4"></div>
          <p className="text-white">Loading courses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <svg 
                className="w-8 h-8 text-sky-400"
                viewBox="0 0 64 64" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  d="M32 0L38.9282 24H25.0718L32 0ZM50.954 18L57.8822 42H44.0258L50.954 18Z" 
                  fill="currentColor"
                />
              </svg>
              <span className="text-xl font-bold text-white">Afritec Bridge</span>
            </Link>
            <Link 
              href="/auth/login" 
              className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-lg transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      <main className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Explore Our Courses
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-4">
              Browse our selection of tech courses and apply directly online. 
              Our AI-powered scoring system ensures fair evaluation for all applicants.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Instant Application • AI-Fair Selection • Free Training</span>
            </div>
          </div>

          {error ? (
            <div className="text-center py-12">
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 max-w-md mx-auto">
                <p className="text-red-300 mb-4">Error: {error}</p>
                <button 
                  onClick={() => window.location.reload()} 
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : courses.length === 0 ? (
            /* Show message when no courses available */
            <div className="text-center py-16">
              <div className="bg-white/5 backdrop-blur-sm border border-gray-700 rounded-xl p-8 max-w-md mx-auto">
                <div className="text-6xl mb-4">📚</div>
                <h3 className="text-2xl font-bold text-white mb-3">No Courses Available Yet</h3>
                <p className="text-gray-300 mb-6">
                  We're working on adding amazing courses for you. Check back soon or sign in to get notified when new courses are available!
                </p>
                <div className="space-y-3">
                  <Link 
                    href="/auth/login"
                    className="block w-full px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-lg transition-all shadow-lg"
                  >
                    Sign In
                  </Link>
                  <Link 
                    href="/auth/register"
                    className="block w-full px-6 py-3 border-2 border-sky-500 hover:bg-sky-500/10 text-sky-400 font-semibold rounded-lg transition-all"
                  >
                    Create Account
                  </Link>
                  <button
                    onClick={() => window.location.reload()}
                    className="block w-full px-6 py-3 border border-gray-600 hover:border-gray-500 text-gray-400 hover:text-white font-medium rounded-lg transition-colors"
                  >
                    🔄 Refresh Page
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Show courses if available */
            <>
              <div className="mb-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">
                    Available Courses
                    <span className="ml-3 text-lg font-normal text-gray-400">({courses.length} {courses.length === 1 ? 'course' : 'courses'})</span>
                  </h2>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 rounded-lg transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </button>
                </div>
              </div>
              <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
                {courses.map((course) => (
                  <PublicCourseCard key={course.id} course={course} />
                ))}
              </div>
            </>
          )}

          {/* Call to Action */}
          <div className="mt-16 text-center">
            <div className="bg-gradient-to-r from-sky-500/10 to-blue-500/10 border border-sky-500/20 rounded-xl p-8">
              <h2 className="text-2xl font-bold text-white mb-3">Ready to Apply?</h2>
              <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                Our application process is designed to identify motivated learners from all backgrounds. 
                Click "Apply Now" on any course to get started - no registration required!
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link 
                  href="#courses"
                  onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-lg transition-all duration-300"
                >
                  Browse Courses
                </Link>
                <Link 
                  href="/auth/login"
                  className="inline-flex items-center px-6 py-3 border border-sky-500 hover:bg-sky-500/10 text-sky-400 font-semibold rounded-lg transition-all duration-300"
                >
                  Already Applied? Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PublicCoursesPage;