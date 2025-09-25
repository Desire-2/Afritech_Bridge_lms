"use client";
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ClientOnly, useIsClient } from '@/lib/hydration-helper';
import { BookOpen, Clock, Trophy, ChevronRight } from 'lucide-react';

interface EnrolledCourseSummary {
  id: string;
  title: string;
  progress: number;
  thumbnailUrl: string;
  nextLesson: string;
}

const StudentDashboardOverviewPage = () => {
  const { user, isAuthenticated } = useAuth();
  const isClient = useIsClient();
  const [dashboardData, setDashboardData] = useState<{
    enrolledCourses: EnrolledCourseSummary[];
    stats: {
      totalCourses: number;
      hoursSpent: number;
      achievements: number;
    };
  } | null>(null);

  useEffect(() => {
    // Simulated API call
    setTimeout(() => {
      setDashboardData({
        enrolledCourses: [
          {
            id: '1',
            title: 'Advanced Python Programming',
            progress: 65,
            thumbnailUrl: '/python-course.jpg',
            nextLesson: 'Decorators and Generators'
          },
          {
            id: '2',
            title: 'Web Development Fundamentals',
            progress: 40,
            thumbnailUrl: '/web-dev-course.jpg',
            nextLesson: 'React State Management'
          },
          {
            id: '3',
            title: 'Data Science Essentials',
            progress: 85,
            thumbnailUrl: '/data-science-course.jpg',
            nextLesson: 'Pandas Data Analysis'
          }
        ],
        stats: {
          totalCourses: 8,
          hoursSpent: 42,
          achievements: 15
        }
      });
    }, 500);
  }, []);

  if (!dashboardData) {
    return (
      <div className="container mx-auto p-6 animate-pulse">
        <div className="h-12 bg-gray-200 rounded w-1/3 mb-8"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((_, i) => (
            <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Welcome Section */}
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
          Welcome back, {user?.first_name || 'Learner'}! 👋
        </h1>
        <p className="text-gray-600">Keep up the great work! You're making amazing progress.</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-indigo-50 p-6 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-indigo-100 rounded-lg">
            <BookOpen className="w-8 h-8 text-indigo-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800">{dashboardData.stats.totalCourses}</p>
            <p className="text-gray-600">Active Courses</p>
          </div>
        </div>

        <div className="bg-amber-50 p-6 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-amber-100 rounded-lg">
            <Clock className="w-8 h-8 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800">{dashboardData.stats.hoursSpent}</p>
            <p className="text-gray-600">Hours Spent</p>
          </div>
        </div>

        <div className="bg-emerald-50 p-6 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-emerald-100 rounded-lg">
            <Trophy className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800">{dashboardData.stats.achievements}</p>
            <p className="text-gray-600">Achievements</p>
          </div>
        </div>
      </div>

      {/* Enrolled Courses */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">Your Courses</h2>
          <Link href="/courses" className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dashboardData.enrolledCourses.map((course) => (
            <div 
              key={course.id}
              className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-300 overflow-hidden group"
            >
              <div className="relative h-48 bg-gray-100">
                <img 
                  src={course.thumbnailUrl}
                  alt={course.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                  <h3 className="text-lg font-semibold text-white">{course.title}</h3>
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-indigo-600">
                    {course.progress}% Complete
                  </span>
                  <span className="text-sm text-gray-500">
                    Next: {course.nextLesson}
                  </span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-blue-500 h-2.5 rounded-full" 
                    style={{ width: `${course.progress}%` }}
                  ></div>
                </div>

                <Link
                  href={`/courses/${course.id}`}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
                >
                  Continue Learning
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Achievements */}
      <section>
        <h2 className="text-2xl font-semibold text-gray-800 mb-6">Recent Achievements</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((_, i) => (
            <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 flex items-center gap-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Trophy className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-gray-800">Python Pro</p>
                <p className="text-sm text-gray-600">Completed 5 Python courses</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

// Wrap the component with ClientOnly to prevent hydration issues
export default function DashboardPage() {
  const isClient = useIsClient();
  
  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-lg text-gray-600">Loading dashboard content...</p>
      </div>
    );
  }
  
  return (
    <ClientOnly>
      <StudentDashboardOverviewPage />
    </ClientOnly>
  );
}