"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { StudentService, EnrolledCourse } from '@/services/student.service';
import { BookOpen, Clock, BarChart3, PlayCircle, CheckCircle2, TrendingUp, Award, Search, Filter, UserCircle, AlertTriangle, CreditCard, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const MyLearningPage = () => {
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'in-progress' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isClient, setIsClient] = useState(false);
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Handle client-side hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const fetchMyLearning = async () => {
      // Only fetch data if user is authenticated and auth loading is complete
      if (!authLoading && isAuthenticated) {
        try {
          setLoading(true);
          const data = await StudentService.getMyLearning();
          // Ensure data is always an array
          setCourses(Array.isArray(data) ? data : []);
          setError(null); // Clear any previous errors
        } catch (err: any) {
          console.error('Error fetching my learning data:', err);
          setError(err.message || 'Failed to load your learning data');
          setCourses([]); // Set empty array on error
        } finally {
          setLoading(false);
        }
      }
    };

    fetchMyLearning();
  }, [isAuthenticated, authLoading]);

  // Ensure courses is always an array before filtering
  const filteredCourses = Array.isArray(courses) ? courses.filter(course => {
    // Filter by status
    const statusMatch = 
      filter === 'all' ? true :
      filter === 'completed' ? course.progress >= 100 :
      filter === 'in-progress' ? course.progress > 0 && course.progress < 100 :
      true;
    
    // Filter by search query
    const searchMatch = searchQuery.trim() === '' || 
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.instructor_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return statusMatch && searchMatch;
  }) : [];

  // Prevent hydration mismatch by showing loading state until client-side
  if (!isClient || loading) {
    return (
      <div className="min-h-screen bg-[#1e293b]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-10 bg-slate-700 rounded-lg w-1/3 mb-4"></div>
            <div className="h-6 bg-slate-700 rounded-lg w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-slate-800 rounded-xl shadow-sm"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-96 bg-slate-800 rounded-xl shadow-sm"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#1e293b] flex items-center justify-center">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-md mx-auto bg-white border border-red-200 rounded-xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Oops! Something went wrong</h3>
            <p className="text-red-600 mb-6">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1e293b]">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                My Learning Journey
              </h1>
              <p className="text-slate-300 text-sm sm:text-base">Track your progress and continue growing</p>
            </div>

          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-700 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-sm">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-400 font-medium">Total Courses</p>
                <p className="text-3xl font-bold text-white">{Array.isArray(courses) ? courses.length : 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-700 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-sm">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-400 font-medium">In Progress</p>
                <p className="text-3xl font-bold text-white">
                  {Array.isArray(courses) ? courses.filter(c => c.progress > 0 && c.progress < 100).length : 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-700 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-sm">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-400 font-medium">Completed</p>
                <p className="text-3xl font-bold text-white">
                  {Array.isArray(courses) ? courses.filter(c => c.progress >= 100).length : 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-700 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-sm">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-400 font-medium">Avg Progress</p>
                <p className="text-3xl font-bold text-white">
                  {Array.isArray(courses) && courses.length > 0 ? Math.round(courses.reduce((sum, c) => sum + c.progress, 0) / courses.length) : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search courses by title, description, or instructor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            
            {/* Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0">
              {[
                { key: 'all', label: 'All Courses', count: Array.isArray(courses) ? courses.length : 0, icon: BookOpen },
                { key: 'in-progress', label: 'In Progress', count: Array.isArray(courses) ? courses.filter(c => c.progress > 0 && c.progress < 100).length : 0, icon: Clock },
                { key: 'completed', label: 'Completed', count: Array.isArray(courses) ? courses.filter(c => c.progress >= 100).length : 0, icon: CheckCircle2 }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key as any)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    filter === tab.key
                      ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    filter === tab.key ? 'bg-white/20 text-white' : 'bg-slate-600 text-slate-300'
                  }`}>
                    {tab.count}
                  </span>
                </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Results Count */}
        {searchQuery && (
          <div className="mb-4 text-sm text-slate-400">
            Found <span className="font-semibold text-white">{filteredCourses.length}</span> course{filteredCourses.length !== 1 ? 's' : ''} matching "{searchQuery}"
          </div>
        )}

        {/* Courses Grid */}
        {filteredCourses.length === 0 ? (
          <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-12 text-center">
            <div className="max-w-sm mx-auto">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-900 to-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                {searchQuery ? <Search className="w-10 h-10 text-indigo-400" /> : <BookOpen className="w-10 h-10 text-indigo-400" />}
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {searchQuery ? 'No matching courses' : 'No courses found'}
              </h3>
              <p className="text-slate-400 mb-6">
                {searchQuery 
                  ? `We couldn't find any courses matching "${searchQuery}". Try different keywords.`
                  : filter === 'all' 
                    ? "You haven't enrolled in any courses yet. Start your learning journey today!" 
                    : `No ${filter.replace('-', ' ')} courses found.`}
              </p>
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="inline-flex items-center px-5 py-2.5 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors font-medium"
                >
                  Clear Search
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => (
              <div key={course.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 overflow-hidden group">
                {/* Course Header with Gradient */}
                <div className="h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500"></div>
                
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                      {course.title}
                    </h3>
                    {course.progress >= 100 && (
                      <div className="flex-shrink-0 ml-2">
                        <Award className="w-6 h-6 text-yellow-500" />
                      </div>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {course.description}
                  </p>

                  {/* Payment Status Banner — cohort-level */}
                  {course.access_allowed === false && (
                    <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50">
                      <div className="flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-amber-800">
                            {course.payment_required
                              ? course.cohort_enrollment_type === 'scholarship' && course.cohort_scholarship_type === 'partial'
                                ? `Partial Scholarship — Payment Required`
                                : 'Tuition Payment Required'
                              : 'Access Restricted'}
                          </p>
                          <p className="text-xs text-amber-700 mt-0.5">
                            {course.payment_required
                              ? course.cohort_effective_price != null && course.cohort_effective_price > 0
                                ? `Amount due: ${course.cohort_currency || 'USD'} ${course.cohort_effective_price.toLocaleString()}${
                                    course.cohort_scholarship_percentage
                                      ? ` (${course.cohort_scholarship_percentage}% scholarship applied)`
                                      : ''
                                  }`
                                : 'Complete your payment to access course content.'
                              : (course.access_reason || 'Contact an administrator for access.')}
                          </p>
                          {course.cohort_installment_enabled && course.cohort_installment_count && course.cohort_installment_count > 1 && (
                            <p className="text-xs text-amber-600 mt-0.5">
                              Installment plan: {course.cohort_installment_count} payments
                              {course.cohort_amount_due != null && ` — ${course.cohort_currency || 'USD'} ${course.cohort_amount_due.toLocaleString()} due now`}
                            </p>
                          )}
                          {course.payment_status === 'completed' && !course.payment_verified && (
                            <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              <Clock className="w-3 h-3 mr-1" /> Verification Pending
                            </span>
                          )}
                          {course.payment_status === 'pending' && (
                            <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              <CreditCard className="w-3 h-3 mr-1" /> Unpaid
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Progress Section */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="text-gray-600 font-medium">Progress</span>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${
                          course.progress >= 100 ? 'text-green-600' :
                          course.progress >= 50 ? 'text-blue-600' :
                          'text-amber-600'
                        }`}>
                          {Math.round(course.progress)}%
                        </span>
                        {course.progress >= 100 && (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className={`h-2.5 rounded-full transition-all duration-500 ${
                          course.progress >= 100 
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                            : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500'
                        }`}
                        style={{ width: `${course.progress}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Course Info */}
                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex items-center text-gray-600">
                      <UserCircle className="w-4 h-4 mr-2 text-gray-400" />
                      <span className="truncate">{course.instructor_name}</span>
                    </div>
                    {course.cohort_label && (
                      <div className="flex items-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                          {course.cohort_label}
                        </span>
                      </div>
                    )}
                    {course.current_lesson && (
                      <div className="flex items-start text-gray-600">
                        <PlayCircle className="w-4 h-4 mr-2 text-gray-400 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-1">Next: {course.current_lesson}</span>
                      </div>
                    )}
                    <div className="flex items-center text-gray-500 text-xs">
                      <Clock className="w-3.5 h-3.5 mr-2" />
                      Enrolled {new Date(course.enrollment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {course.access_allowed === false ? (
                      <div className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed font-medium">
                        <AlertTriangle className="w-4 h-4" />
                        {course.payment_required ? 'Payment Pending' : 'Access Locked'}
                      </div>
                    ) : course.progress >= 100 ? (
                      <Link
                        href={`/learn/${course.id}`}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-sm hover:shadow-md font-medium"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Review Course
                      </Link>
                    ) : (
                      <Link
                        href={`/learn/${course.id}`}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg hover:from-indigo-700 hover:to-blue-700 transition-all shadow-sm hover:shadow-md font-medium"
                      >
                        <PlayCircle className="w-4 h-4" />
                        {course.progress > 0 ? 'Continue' : 'Start'}
                      </Link>
                    )}
                    <Link
                      href={`/courses/${course.id}`}
                      className="flex items-center justify-center px-4 py-2.5 border-2 border-gray-200 text-gray-700 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all"
                      title="View Progress"
                    >
                      <BarChart3 className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                {/* Status Badge at bottom */}
                {course.access_allowed === false ? (
                  <div className="px-6 pb-4">
                    <div className="flex items-center justify-center gap-2 py-2 bg-amber-50 rounded-lg border border-amber-200">
                      <CreditCard className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-semibold text-amber-700">
                        {course.enrollment_status === 'pending_payment' ? 'Pending Payment' : 'Access Restricted'}
                      </span>
                    </div>
                  </div>
                ) : course.progress >= 100 ? (
                  <div className="px-6 pb-4">
                    <div className="flex items-center justify-center gap-2 py-2 bg-green-50 rounded-lg border border-green-200">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-700">Course Completed!</span>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyLearningPage;
