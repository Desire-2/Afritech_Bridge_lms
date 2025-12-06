"use client";

import React, { useState, useEffect } from 'react';

interface FormData {
  title: string;
  description: string;
  learning_objectives: string;
  target_audience: string;
  estimated_duration: string;
  instructor_id: number | string;
  is_published: boolean;
}

interface CourseFormProps {
  courseId?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const CourseForm: React.FC<CourseFormProps> = ({ courseId, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    learning_objectives: '',
    target_audience: '',
    estimated_duration: '',
    instructor_id: '',
    is_published: false,
  });

  const [instructors, setInstructors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    // Fetch instructors
    const fetchInstructors = async () => {
      try {
        // This would call the API to get instructors with role 'instructor'
        // For now, we'll leave it as a placeholder
      } catch (err: any) {
        console.error('Failed to fetch instructors:', err);
      }
    };

    fetchInstructors();
  }, []);

  useEffect(() => {
    if (courseId) {
      setIsEditMode(true);
      const fetchCourse = async () => {
        try {
          setLoading(true);
          // This would call the API to fetch course details
          // const response = await fetch(`/api/v1/admin/courses/${courseId}`);
          // const course = await response.json();
          // setFormData(course);
        } catch (err: any) {
          setError(`Failed to load course: ${err.message}`);
        } finally {
          setLoading(false);
        }
      };
      fetchCourse();
    }
  }, [courseId]);

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      setError('Course title is required');
      return false;
    }
    if (!formData.description.trim()) {
      setError('Course description is required');
      return false;
    }
    if (!formData.instructor_id) {
      setError('Please select an instructor');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      
      if (isEditMode && courseId) {
        // Call update endpoint
        // await AdminService.updateCourse(courseId, formData);
        setSuccess('Course updated successfully!');
      } else {
        // Call create endpoint
        // await AdminService.createCourse(formData);
        setSuccess('Course created successfully!');
      }

      setTimeout(() => {
        onSuccess?.();
      }, 1500);
    } catch (err: any) {
      setError(`Failed to save course: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  if (loading && isEditMode) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        {isEditMode ? 'Edit Course' : 'Create New Course'}
      </h1>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
          {success}
        </div>
      )}

      <div className="space-y-6">
        {/* Course Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Course Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Enter course title"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">The main title of your course</p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Enter course description"
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">Brief overview of what students will learn</p>
        </div>

        {/* Learning Objectives */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Learning Objectives
          </label>
          <textarea
            name="learning_objectives"
            value={formData.learning_objectives}
            onChange={handleChange}
            placeholder="What will students learn? (one per line)"
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Target Audience */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target Audience
          </label>
          <input
            type="text"
            name="target_audience"
            value={formData.target_audience}
            onChange={handleChange}
            placeholder="e.g., Beginners, Advanced, Professionals"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Estimated Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Estimated Duration
          </label>
          <input
            type="text"
            name="estimated_duration"
            value={formData.estimated_duration}
            onChange={handleChange}
            placeholder="e.g., 4 weeks, 40 hours"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Instructor Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Instructor <span className="text-red-500">*</span>
          </label>
          <select
            name="instructor_id"
            value={formData.instructor_id}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select an instructor</option>
            {instructors.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>
                {instructor.first_name} {instructor.last_name} ({instructor.username})
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">Select who will teach this course</p>
        </div>

        {/* Publish Status */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="is_published"
              checked={formData.is_published}
              onChange={handleChange}
              className="w-4 h-4 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              Publish course immediately
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-2">
            If unchecked, course will be saved as draft
          </p>
        </div>
      </div>

      {/* Buttons */}
      <div className="mt-8 flex gap-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {loading ? 'Saving...' : isEditMode ? 'Update Course' : 'Create Course'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default CourseForm;
