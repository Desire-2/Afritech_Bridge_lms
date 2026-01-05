'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { BarChart3, TrendingUp, Target, Clock, BookOpen, Award, Trophy, Calendar, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StudentService, EnrolledCourse } from '@/services/student.service';
import ProgressAnalytics from '@/components/student/ProgressAnalytics';

const MyProgressPage = () => {
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'analytics'>('overview');
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
        const [learningData, dashboardData] = await Promise.all([
          StudentService.getMyLearning(),
          StudentService.getDashboard()
        ]);
        
        // Extract courses from learning data
        // Backend returns { active_courses, completed_courses, course_stats, ... }
        const allCourses = [
          ...(learningData.active_courses || []),
          ...(learningData.completed_courses || [])
        ];
        setCourses(allCourses);
        
        // Extract stats from dashboard
        // Backend returns { enrolled_courses, stats, achievements, recent_activity }
        if (dashboardData.stats) {
          setStats(dashboardData.stats);
        }
      } catch (err: any) {
        console.error('Error fetching progress data:', err);
        setError('Failed to load progress data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const calculateOverallProgress = () => {
    if (courses.length === 0) return 0;
    const totalProgress = courses.reduce((sum, course) => sum + course.progress, 0);
    return Math.round(totalProgress / courses.length);
  };

  const calculateStreakData = () => {
    // Mock streak calculation - in real app, this would come from backend
    const currentStreak = 7;
    const longestStreak = 14;
    return { currentStreak, longestStreak };
  };

  const { currentStreak, longestStreak } = calculateStreakData();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1e293b] p-4 sm:p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-700 rounded w-1/3 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-slate-800 rounded-xl"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="h-96 bg-slate-800 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#1e293b] flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-red-900/50 rounded-xl p-8 text-center max-w-md">
          <p className="text-red-400 text-lg mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1e293b]">
      <div className="container mx-auto p-4 sm:p-6">
        {/* Header with View Toggle */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">My Progress</h1>
              <p className="text-slate-400">Track your learning journey and achievements</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setViewMode('overview')}
                variant={viewMode === 'overview' ? 'default' : 'outline'}
                className={viewMode === 'overview' 
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white'
                  : 'border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                }
              >
                Overview
              </Button>
              <Button
                onClick={() => setViewMode('analytics')}
                variant={viewMode === 'analytics' ? 'default' : 'outline'}
                className={viewMode === 'analytics'
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white'
                  : 'border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                }
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Detailed Analytics
              </Button>
            </div>
          </div>
        </div>

        {/* Conditional Rendering based on viewMode */}
        {viewMode === 'analytics' ? (
          <ProgressAnalytics />
        ) : (
          <>
            {/* Key Statistics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
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
        <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Course Progress Overview</h2>
          
          {courses.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400 mb-4">No courses enrolled yet. Contact your instructor for course access.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {courses.slice(0, 5).map((course) => (
                <div key={course.id} className="border border-slate-700 rounded-lg p-4 bg-slate-900/50">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-white truncate">{course.title}</h3>
                    <span className="text-sm font-medium text-slate-300">
                      {Math.round(course.progress)}%
                    </span>
                  </div>
                  
                  <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${course.progress}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Instructor: {course.instructor_name}</span>
                    <span>Enrolled: {new Date(course.enrollment_date).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/learn/${course.id}`}
                      className="text-xs px-3 py-1 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors"
                    >
                      Continue Learning
                    </Link>
                    <Link
                      href={`/courses/${course.id}`}
                      className="text-xs px-3 py-1 bg-slate-700 text-slate-300 rounded-full hover:bg-slate-600 transition-colors"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
              
              {courses.length > 5 && (
                <Link 
                  href="/student/mylearning"
                  className="block text-center py-2 text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  View All Courses ({courses.length})
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Learning Insights */}
        <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Learning Insights</h2>
          
          <div className="space-y-6">
            {/* Learning Streak */}
            <div className="bg-gradient-to-r from-orange-900/30 to-red-900/30 border border-orange-800/50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-orange-600/20 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white">Learning Streak</h3>
                  <p className="text-sm text-slate-400">Keep up the momentum!</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-bold text-orange-400">{currentStreak}</p>
                  <p className="text-xs text-slate-400">Current Streak (days)</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{longestStreak}</p>
                  <p className="text-xs text-slate-400">Longest Streak (days)</p>
                </div>
              </div>
            </div>

            {/* Completion Rate */}
            <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-800/50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-green-600/20 rounded-lg">
                  <Trophy className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white">Completion Rate</h3>
                  <p className="text-sm text-slate-400">Course completion success</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1 text-slate-300">
                    <span>Completion Rate</span>
                    <span className="font-medium text-white">
                      {stats.total_courses > 0 
                        ? Math.round((stats.completed_courses / stats.total_courses) * 100)
                        : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
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
            <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-800/50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-600/20 rounded-lg">
                  <Calendar className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white">Weekly Goal</h3>
                  <p className="text-sm text-slate-400">Study time target</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1 text-slate-300">
                    <span>5 hours/week</span>
                    <span className="font-medium text-white">3.5/5 hours</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: '70%' }}
                    ></div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                1.5 hours remaining to reach your weekly goal
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/student/mylearning"
            className="flex items-center gap-3 p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:bg-slate-900 hover:border-indigo-600 transition-all group"
          >
            <BookOpen className="w-8 h-8 text-indigo-400 group-hover:text-indigo-300" />
            <div>
              <p className="font-medium text-white">Continue Learning</p>
              <p className="text-sm text-slate-400">Resume your courses</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 ml-auto group-hover:text-indigo-400" />
          </Link>
          

          
          <Link
            href="/student/certificates"
            className="flex items-center gap-3 p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:bg-slate-900 hover:border-amber-600 transition-all group"
          >
            <Trophy className="w-8 h-8 text-amber-400 group-hover:text-amber-300" />
            <div>
              <p className="font-medium text-white">View Achievements</p>
              <p className="text-sm text-slate-400">See your badges</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 ml-auto group-hover:text-amber-400" />
          </Link>
        </div>
      </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MyProgressPage;