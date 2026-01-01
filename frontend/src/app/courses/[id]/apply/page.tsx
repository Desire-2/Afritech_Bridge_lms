'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import CourseApplicationForm from '@/components/applications/CourseApplicationForm';
import { CourseApiService } from '@/services/api';
import { Course } from '@/services/api/types';
import { Loader2, AlertCircle, CheckCircle2, BookOpen, Clock, User, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function CourseApplicationPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = parseInt(params.id as string);
  
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [existingApplication, setExistingApplication] = useState<any>(null);

  useEffect(() => {
    const loadCourse = async () => {
      try {
        const course = await CourseApiService.getCourseDetails(courseId);
        setCourse(course);
      } catch (err: any) {
        setError(err.message || 'Failed to load course');
      } finally {
        setLoading(false);
      }
    };

    if (courseId) {
      loadCourse();
    }
  }, [courseId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="w-12 h-12 animate-spin text-sky-600 mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Loading course details...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 py-12">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-900">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">
                    Unable to Load Course
                  </h3>
                  <p className="text-red-700 dark:text-red-300 mb-4">
                    {error || 'Course not found'}
                  </p>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => router.back()}
                      className="border-red-300 text-red-700 hover:bg-red-100"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Go Back
                    </Button>
                    <Button
                      onClick={() => router.push('/courses')}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Browse Courses
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Back Button */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Course
          </Button>
        </div>

        {/* Course Information Card */}
        <Card className="mb-8 border-sky-200 dark:border-sky-900 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-t-lg">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-2xl mb-2">Apply for Course</CardTitle>
                <CardDescription className="text-sky-100 text-base">
                  {course.title}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {course.instructor_name && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-100 dark:bg-sky-900 rounded-lg">
                    <User className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Instructor</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{course.instructor_name}</p>
                  </div>
                </div>
              )}
              {course.estimated_duration && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                    <Clock className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Duration</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{course.estimated_duration}</p>
                  </div>
                </div>
              )}
              {course.level && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Level</p>
                    <p className="font-semibold text-gray-900 dark:text-white capitalize">{course.level}</p>
                  </div>
                </div>
              )}
            </div>
            
            {course.description && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">About this course</h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                  {course.description.substring(0, 300)}{course.description.length > 300 ? '...' : ''}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Application Form */}
        <CourseApplicationForm
          courseId={courseId}
          courseTitle={course.title}
          courseData={course}
          onSuccess={(applicationId) => {
            console.log('Application submitted:', applicationId);
            // Show success and redirect after delay
            setTimeout(() => {
              router.push('/courses');
            }, 5000);
          }}
          onCancel={() => {
            router.back();
          }}
        />
      </div>
    </div>
  );
}