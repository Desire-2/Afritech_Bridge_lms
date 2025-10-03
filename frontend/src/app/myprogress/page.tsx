"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { StudentService, EnrolledCourse } from '@/services/student.service';
import { BarChart3, Clock, Trophy, BookOpen, TrendingUp, Calendar } from 'lucide-react';

const MyProgressPage = () => {
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total_courses: 0,
    completed_courses: 0,
    hours_spent: 0,
    achievements: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [coursesData, dashboardData] = await Promise.all([
          StudentService.getMyLearning(),
          StudentService.getDashboard()
        ]);
        setCourses(coursesData);
        setStats(dashboardData.stats);
      } catch (err: any) {
        setError(err.message || 'Failed to load progress data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const calculateStreakData = () => {
    // Mock streak calculation - in real app, this would come from backend
    const currentStreak = 7;
    const longestStreak = 14;
    return { currentStreak, longestStreak };
  };

  const { currentStreak, longestStreak } = calculateStreakData();

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map((_, i) => (
              <div key={i} className="h-96 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600 text-lg">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">My Progress</h1>
        <p className="text-gray-600">Track your learning journey and achievements</p>
      </div>

      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Courses</p>
              <p className="text-3xl font-bold">{stats.total_courses}</p>
            </div>
            <BookOpen className="w-10 h-10 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Completed</p>
              <p className="text-3xl font-bold">{stats.completed_courses}</p>
            </div>
            <Trophy className="w-10 h-10 text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Hours Studied</p>
              <p className="text-3xl font-bold">{stats.hours_spent}</p>
            </div>
            <Clock className="w-10 h-10 text-purple-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-6 rounded-xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-sm">Achievements</p>
              <p className="text-3xl font-bold">{stats.achievements}</p>
            </div>
            <BarChart3 className="w-10 h-10 text-amber-200" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Course Progress Overview */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Course Progress Overview</h2>
          
          {courses.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No courses enrolled yet</p>
              <Link 
                href="/courses"
                className="inline-block mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Browse Courses
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {courses.slice(0, 5).map((course) => (
                <div key={course.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-800 truncate">{course.title}</h3>
                    <span className="text-sm font-medium text-gray-600">
                      {Math.round(course.progress)}%
                    </span>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${course.progress}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Instructor: {course.instructor_name}</span>
                    <span>Enrolled: {new Date(course.enrollment_date).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/learn/${course.id}`}
                      className="text-xs px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full hover:bg-indigo-200"
                    >
                      Continue Learning
                    </Link>
                    <Link
                      href={`/myprogress/${course.id}`}
                      className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
              
              {courses.length > 5 && (
                <Link 
                  href="/mylearning"
                  className="block text-center py-2 text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  View All Courses ({courses.length})
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Learning Insights */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Learning Insights</h2>
          
          <div className="space-y-6">
            {/* Learning Streak */}
            <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-800">Learning Streak</h3>
                  <p className="text-sm text-gray-600">Keep up the momentum!</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-bold text-orange-600">{currentStreak}</p>
                  <p className="text-xs text-gray-600">Current Streak (days)</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{longestStreak}</p>
                  <p className="text-xs text-gray-600">Longest Streak (days)</p>
                </div>
              </div>
            </div>

            {/* Completion Rate */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Trophy className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-800">Completion Rate</h3>
                  <p className="text-sm text-gray-600">Course completion success</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Completion Rate</span>
                    <span className="font-medium">
                      {stats.total_courses > 0 
                        ? Math.round((stats.completed_courses / stats.total_courses) * 100)
                        : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full"
                      style={{ 
                        width: `${stats.total_courses > 0 
                          ? (stats.completed_courses / stats.total_courses) * 100 
                          : 0}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Weekly Goal */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-800">Weekly Goal</h3>
                  <p className="text-sm text-gray-600">Study time target</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span>5 hours/week</span>
                    <span className="font-medium">3.5/5 hours</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: '70%' }}
                    ></div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                1.5 hours remaining to reach your weekly goal
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-gray-50 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/mylearning"
            className="flex items-center gap-3 p-4 bg-white rounded-lg border hover:shadow-md transition-shadow"
          >
            <BookOpen className="w-8 h-8 text-indigo-600" />
            <div>
              <p className="font-medium text-gray-800">Continue Learning</p>
              <p className="text-sm text-gray-600">Resume your courses</p>
            </div>
          </Link>
          
          <Link
            href="/courses"
            className="flex items-center gap-3 p-4 bg-white rounded-lg border hover:shadow-md transition-shadow"
          >
            <TrendingUp className="w-8 h-8 text-green-600" />
            <div>
              <p className="font-medium text-gray-800">Explore Courses</p>
              <p className="text-sm text-gray-600">Find new learning paths</p>
            </div>
          </Link>
          
          <Link
            href="/dashboard/profile"
            className="flex items-center gap-3 p-4 bg-white rounded-lg border hover:shadow-md transition-shadow"
          >
            <Trophy className="w-8 h-8 text-amber-600" />
            <div>
              <p className="font-medium text-gray-800">View Achievements</p>
              <p className="text-sm text-gray-600">See your badges</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MyProgressPage;