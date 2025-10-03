import { useState, useEffect } from 'react';
import { CourseService } from '@/services/course.service';
import { ApiErrorHandler } from '@/lib/error-handler';
import { Course, CreateCourseRequest } from '@/types/api';

export const useCourses = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await CourseService.getAllCourses();
      setCourses(data);
    } catch (err) {
      setError(ApiErrorHandler.getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const createCourse = async (courseData: CreateCourseRequest) => {
    try {
      const newCourse = await CourseService.createCourse(courseData);
      setCourses(prev => [...prev, newCourse]);
      return newCourse;
    } catch (err) {
      throw ApiErrorHandler.handleError(err);
    }
  };

  const updateCourse = async (courseId: number, courseData: Partial<CreateCourseRequest>) => {
    try {
      const updatedCourse = await CourseService.updateCourse(courseId, courseData);
      setCourses(prev => prev.map(course => 
        course.id === courseId ? updatedCourse : course
      ));
      return updatedCourse;
    } catch (err) {
      throw ApiErrorHandler.handleError(err);
    }
  };

  const deleteCourse = async (courseId: number) => {
    try {
      await CourseService.deleteCourse(courseId);
      setCourses(prev => prev.filter(course => course.id !== courseId));
    } catch (err) {
      throw ApiErrorHandler.handleError(err);
    }
  };

  return {
    courses,
    loading,
    error,
    refetch: fetchCourses,
    createCourse,
    updateCourse,
    deleteCourse,
  };
};

export const useCourse = (courseId: number) => {
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourse = async () => {
    if (!courseId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await CourseService.getCourse(courseId);
      setCourse(data);
    } catch (err) {
      setError(ApiErrorHandler.getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourse();
  }, [courseId]);

  return {
    course,
    loading,
    error,
    refetch: fetchCourse,
  };
};