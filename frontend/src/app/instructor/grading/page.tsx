"use client";

import React, { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthContext } from '@/contexts/AuthContext';

// Placeholder types
interface GradingItem {
  id: string; // Could be quiz_attempt_id or assignment_submission_id
  studentName: string;
  courseTitle: string;
  itemName: string; // e.g., "Module 1 Quiz" or "Assignment 2: Essay"
  submittedAt: string;
  status: 'Pending Grading' | 'Graded';
  courseId: string;
  studentId: string;
}

// Placeholder data - replace with API call to /api/instructor/grading/pending
const placeholderGradingItems: GradingItem[] = [
  {
    id: 'q_att_001',
    studentName: 'Alice Wonderland',
    courseTitle: 'Introduction to Python Programming',
    itemName: 'Module 2 Quiz',
    submittedAt: '2023-02-05T14:30:00Z',
    status: 'Pending Grading',
    courseId: 'crs001',
    studentId: 'std001',
  },
  {
    id: 'q_att_002',
    studentName: 'Bob The Builder',
    courseTitle: 'Web Development Fundamentals',
    itemName: 'HTML & CSS Basics Quiz',
    submittedAt: '2023-02-10T10:15:00Z',
    status: 'Pending Grading',
    courseId: 'crs002',
    studentId: 'std002',
  },
  {
    id: 'as_sub_001',
    studentName: 'Charlie Brown',
    courseTitle: 'Introduction to Python Programming',
    itemName: 'Assignment 1: Python Functions',
    submittedAt: '2023-02-12T18:00:00Z',
    status: 'Pending Grading',
    courseId: 'crs001',
    studentId: 'std003',
  },
];

const GradingPage = () => {
  const [gradingItems, setGradingItems] = useState<GradingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authContext = useContext(AuthContext);

  useEffect(() => {
    const fetchGradingItems = async () => {
      setLoading(true);
      setError(null);
      try {
        // Replace with actual API call: GET /api/instructor/grading/pending
        // const response = await fetch('/api/instructor/grading/pending', {
        //   headers: { 'Authorization': `Bearer ${authContext?.token}` },
        // });
        // if (!response.ok) throw new Error('Failed to fetch items pending grading');
        // const data = await response.json();
        // setGradingItems(data.items);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
        setGradingItems(placeholderGradingItems.filter(item => item.status === 'Pending Grading'));
      } catch (err: any) {
        setError(err.message || 'An error occurred while fetching grading items.');
      } finally {
        setLoading(false);
      }
    };

    if (authContext?.token) {
      fetchGradingItems();
    }
  }, [authContext?.token]);

  const handleGradeItem = (item: GradingItem) => {
    console.log(`Grade item ${item.id} for ${item.studentName}`);
    // Navigate to a specific grading page for this item, e.g.,
    // router.push(`/instructor/grading/item/${item.id}`);
    // Or open a grading modal
    alert(`Placeholder: Navigate to grade item ID: ${item.id}`);
  };

  if (loading) return <div className="text-center py-10">Loading items pending grading...</div>;
  if (error) return <div className="text-center py-10 text-red-500">Error: {error}</div>;

  return (
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Grading Center</h1>

      {gradingItems.length === 0 && !loading && (
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <p className="text-gray-600">No items currently pending grading. Well done!</p>
        </div>
      )}

      {gradingItems.length > 0 && (
        <div className="bg-white shadow-md rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted At</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {gradingItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <Link href={`/instructor/courses/${item.courseId}/students/${item.studentId}/progress`} legacyBehavior>
                      <a className="text-blue-600 hover:underline">{item.studentName}</a>
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                     <Link href={`/instructor/courses/${item.courseId}`} legacyBehavior>
                        <a className="text-blue-600 hover:underline">{item.courseTitle}</a>
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.itemName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(item.submittedAt).toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button 
                      onClick={() => handleGradeItem(item)} 
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      Grade Now
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* TODO: Add pagination if list is long */}
      {/* TODO: Implement actual grading modal/page navigation */}
    </div>
  );
};

export default GradingPage;

