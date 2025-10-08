'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Course } from '@/types/api';

// Public Course Card Component
const PublicCourseCard: React.FC<{ course: Course }> = ({ course }) => (
  <div className="bg-white dark:bg-gray-800 shadow-lg overflow-hidden rounded-xl hover:shadow-xl transition-all duration-300">
    <div className="px-6 py-6">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        {course.title}
      </h3>
      <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">
        {course.description ? course.description.substring(0, 150) + '...' : 'No description available'}
      </p>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200">
          Course
        </span>
        <Link 
          href="/auth/login?redirect=/student/courses" 
          className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-medium text-sm"
        >
          Enroll Now →
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
        // Simulate loading delay for better UX
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // For public pages, we'll show mock course data to avoid authentication issues
        // In a real implementation, you might have a separate public API endpoint
        const mockCourses: Course[] = [
          {
            id: 1,
            title: "Introduction to Web Development",
            description: "Learn the fundamentals of HTML, CSS, and JavaScript to build your first websites. Perfect for beginners with no prior coding experience.",
            instructor_id: 1,
            is_published: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 2,
            title: "Python Programming Masterclass",
            description: "Master Python programming from basics to advanced concepts. Build real-world projects and prepare for a career in tech.",
            instructor_id: 2,
            is_published: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 3,
            title: "React & Next.js Development",
            description: "Build modern web applications with React and Next.js. Learn hooks, state management, and deployment strategies.",
            instructor_id: 1,
            is_published: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 4,
            title: "Data Science with Python",
            description: "Analyze data, create visualizations, and build machine learning models using Python and popular libraries.",
            instructor_id: 3,
            is_published: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 5,
            title: "Mobile App Development",
            description: "Create cross-platform mobile applications using React Native. Deploy to both iOS and Android stores.",
            instructor_id: 2,
            is_published: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 6,
            title: "Cloud Computing with AWS",
            description: "Learn cloud infrastructure, deployment, and scaling using Amazon Web Services. Get AWS certified.",
            instructor_id: 3,
            is_published: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ];
        
        setCourses(mockCourses);
      } catch (err: any) {
        setError('Failed to load courses. Please try again later.');
        console.error('Error loading courses:', err);
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
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Start learning and unlock your potential with our wide range of coding courses. 
              Join thousands of students building their tech careers.
            </p>
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
            /* Show login prompt when no courses available */
            <div className="text-center py-16">
              <div className="bg-white/5 backdrop-blur-sm border border-gray-700 rounded-xl p-8 max-w-md mx-auto">
                <div className="text-4xl mb-4">🎓</div>
                <h3 className="text-xl font-semibold text-white mb-3">Ready to Start Learning?</h3>
                <p className="text-gray-300 mb-6">
                  Sign in to explore our full catalog of courses and start your learning journey.
                </p>
                <div className="space-y-3">
                  <Link 
                    href="/auth/login"
                    className="block w-full px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-lg transition-colors"
                  >
                    Sign In to Explore
                  </Link>
                  <Link 
                    href="/auth/register"
                    className="block w-full px-6 py-3 border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white font-medium rounded-lg transition-colors"
                  >
                    Create Account
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            /* Show courses if available */
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <PublicCourseCard key={course.id} course={course} />
              ))}
            </div>
          )}

          {/* Call to Action */}
          <div className="mt-16 text-center">
            <div className="bg-gradient-to-r from-sky-500/10 to-blue-500/10 border border-sky-500/20 rounded-xl p-8">
              <h2 className="text-2xl font-bold text-white mb-3">Join Our Learning Community</h2>
              <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                Connect with instructors, collaborate with peers, and track your progress 
                in a supportive learning environment designed for African tech talent.
              </p>
              <Link 
                href="/auth/register"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-lg transition-all duration-300"
              >
                Get Started Today
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PublicCoursesPage;