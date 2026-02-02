"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, X, AlertCircle } from 'lucide-react';
import { Course, Announcement, CreateAnnouncementRequest } from '@/types/api';
import { AnnouncementService } from '@/services/course.service';
import InstructorService from '@/services/instructor.service';

interface AnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (announcement: Announcement) => void;
  editAnnouncement?: Announcement | null;
  preSelectedCourseId?: number;
}

const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editAnnouncement,
  preSelectedCourseId
}) => {
  const [formData, setFormData] = useState({
    course_id: preSelectedCourseId || '',
    title: '',
    content: ''
  });
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!editAnnouncement;

  // Load courses on mount
  useEffect(() => {
    if (isOpen) {
      loadCourses();
    }
  }, [isOpen]);

  // Set form data when editing
  useEffect(() => {
    if (editAnnouncement) {
      setFormData({
        course_id: editAnnouncement.course_id.toString(),
        title: editAnnouncement.title,
        content: editAnnouncement.content
      });
    } else {
      // Reset form when creating new announcement
      setFormData({
        course_id: preSelectedCourseId?.toString() || '',
        title: '',
        content: ''
      });
    }
  }, [editAnnouncement, preSelectedCourseId]);

  const loadCourses = async () => {
    setLoadingCourses(true);
    try {
      const coursesData = await InstructorService.getMyCourses();
      setCourses(Array.isArray(coursesData) ? coursesData : []);
    } catch (err: any) {
      console.error('Error loading courses:', err);
      setError('Failed to load courses. Please try again.');
    } finally {
      setLoadingCourses(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error when user starts typing
    if (error) setError(null);
  };

  const validateForm = (): string | null => {
    if (!formData.course_id) return 'Please select a course';
    if (!formData.title.trim()) return 'Please enter a title';
    if (!formData.content.trim()) return 'Please enter content';
    if (formData.title.length > 255) return 'Title must be 255 characters or less';
    if (formData.content.length > 5000) return 'Content must be 5000 characters or less';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const announcementData: CreateAnnouncementRequest = {
        course_id: parseInt(formData.course_id),
        title: formData.title.trim(),
        content: formData.content.trim()
      };

      let result: Announcement;
      if (isEditMode && editAnnouncement) {
        result = await AnnouncementService.updateAnnouncement(editAnnouncement.id, announcementData);
      } else {
        result = await AnnouncementService.createAnnouncementAsInstructor(announcementData);
      }

      onSuccess(result);
      onClose();
    } catch (err: any) {
      console.error('Error saving announcement:', err);
      setError(err.message || 'Failed to save announcement. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError(null);
      onClose();
    }
  };

  const selectedCourse = courses.find(course => course.id.toString() === formData.course_id);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{isEditMode ? 'Edit Announcement' : 'Create New Announcement'}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              disabled={loading}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? 'Update the announcement details below.' 
              : 'Create a new announcement to communicate with your students.'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Course Selection */}
          <div className="space-y-2">
            <Label htmlFor="course">
              Course <span className="text-red-500">*</span>
            </Label>
            {loadingCourses ? (
              <div className="flex items-center justify-center p-3 border rounded-md">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-gray-500">Loading courses...</span>
              </div>
            ) : (
              <Select
                value={formData.course_id}
                onValueChange={(value) => handleInputChange('course_id', value)}
                disabled={loading || isEditMode} // Disable in edit mode
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-gray-500 text-center">
                      No courses found. You need to create a course first.
                    </div>
                  ) : (
                    courses.map((course) => (
                      <SelectItem key={course.id} value={course.id.toString()}>
                        <div className="flex flex-col">
                          <span className="font-medium">{course.title}</span>
                          <span className="text-xs text-gray-500">
                            {course.is_published ? 'Published' : 'Draft'}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
            {isEditMode && selectedCourse && (
              <p className="text-sm text-gray-500">
                Currently assigned to: <strong>{selectedCourse.title}</strong>
              </p>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter announcement title"
              disabled={loading}
              maxLength={255}
            />
            <div className="text-xs text-gray-500 text-right">
              {formData.title.length}/255 characters
            </div>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">
              Content <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => handleInputChange('content', e.target.value)}
              placeholder="Enter announcement content..."
              disabled={loading}
              className="min-h-[150px] resize-none"
              maxLength={5000}
            />
            <div className="text-xs text-gray-500 text-right">
              {formData.content.length}/5000 characters
            </div>
          </div>

          {/* Preview Section */}
          {formData.title || formData.content ? (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="border rounded-md p-4 bg-gray-50 dark:bg-gray-800">
                {formData.title && (
                  <h3 className="font-semibold text-lg mb-2">{formData.title}</h3>
                )}
                {selectedCourse && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    For Course: <strong>{selectedCourse.title}</strong>
                  </p>
                )}
                {formData.content && (
                  <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {formData.content}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </form>

        <DialogFooter className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || !formData.course_id || !formData.title.trim() || !formData.content.trim()}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEditMode ? 'Update Announcement' : 'Create Announcement'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AnnouncementModal;