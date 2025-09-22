'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation'; // To get current lesson if needed

interface Lesson {
  id: number;
  title: string;
  // Add other relevant properties like content_type, is_completed by user
}

interface Module {
  id: number;
  title: string;
  lessons: Lesson[];
}

interface CourseStructure {
  id: number;
  title: string;
  modules: Module[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

interface CourseNavigationSidebarProps {
  courseId: string;
}

const CourseNavigationSidebar: React.FC<CourseNavigationSidebarProps> = ({ courseId }) => {
  const [courseStructure, setCourseStructure] = useState<CourseStructure | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const params = useParams();
  const currentLessonId = params?.lessonId as string; // Get lessonId from route if available

  useEffect(() => {
    if (!courseId) return;

    const fetchCourseStructure = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Assuming an endpoint like /courses/:courseId/structure or similar
        // For now, we might fetch the full course detail and extract modules/lessons
        const response = await fetch(`${API_URL}/courses/${courseId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch course structure');
        }
        const data: CourseStructure = await response.json(); // Adjust based on actual API response
        setCourseStructure(data);
      } catch (err: any) {
        setError(err.message || 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCourseStructure();
  }, [courseId]);

  if (isLoading) {
    return <div className="w-64 bg-gray-800 text-white p-4">Loading navigation...</div>;
  }

  if (error) {
    return <div className="w-64 bg-gray-800 text-white p-4">Error: {error}</div>;
  }

  if (!courseStructure) {
    return <div className="w-64 bg-gray-800 text-white p-4">No course data.</div>;
  }

  return (
    <aside className="w-80 bg-gray-50 border-r border-gray-200 p-5 overflow-y-auto">
      <h2 className="text-xl font-semibold text-gray-800 mb-4 truncate" title={courseStructure.title}>
        {courseStructure.title}
      </h2>
      <nav>
        {courseStructure.modules?.map((module, moduleIndex) => (
          <div key={module.id} className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Module {moduleIndex + 1}: {module.title}
            </h3>
            <ul>
              {module.lessons?.map((lesson) => (
                <li key={lesson.id} className="mb-1">
                  <Link
                    href={`/learn/${courseId}/${module.id}/${lesson.id}`}
                    className={`block px-3 py-2 rounded-md text-sm font-medium 
                                          ${
                                            currentLessonId === String(lesson.id)
                                              ? 'bg-indigo-100 text-indigo-700'
                                              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                                          }`}
                  >
                    {/* Add icon for lesson type or completion status here */}
                    {lesson.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default CourseNavigationSidebar;

