"use client";

import React from 'react';
import { motion } from 'framer-motion';
import StudentAnnouncements from '@/components/student/StudentAnnouncements';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, BookOpen } from 'lucide-react';

const StudentAnnouncementsPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Bell className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Course Announcements
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Stay updated with important announcements from your courses
              </p>
            </div>
          </div>
        </motion.div>

        {/* Announcements Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <StudentAnnouncements 
            className="bg-white dark:bg-gray-800 shadow-lg border-0" 
            maxItems={50} 
            showHeader={false}
          />
        </motion.div>

        {/* Help Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-8"
        >
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-blue-800 dark:text-blue-200">
                <BookOpen className="w-5 h-5" />
                <span>About Announcements</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
                <p>
                  <strong>Course Announcements</strong> are important messages from your instructors about:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Assignment due dates and changes</li>
                  <li>Exam schedules and updates</li>
                  <li>Course material releases</li>
                  <li>Class cancellations or schedule changes</li>
                  <li>Important course-related information</li>
                </ul>
                <p className="mt-3">
                  Make sure to check this page regularly to stay informed about your courses.
                  New announcements will appear with a "New" badge.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default StudentAnnouncementsPage;