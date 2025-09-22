"use client";

import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';

// Placeholder for FlaggedContent type
interface FlaggedContent {
  id: string;
  contentType: 'forum_post' | 'comment'; // Example content types
  contentSnippet: string;
  reason: string;
  reporterUsername: string;
  reportedAt: string;
  status: 'pending' | 'resolved_approved' | 'resolved_rejected';
}

// Placeholder data - replace with API calls
const placeholderFlaggedContent: FlaggedContent[] = [
  {
    id: 'flag001',
    contentType: 'forum_post',
    contentSnippet: 'This is an inappropriate comment that violates community guidelines...',
    reason: 'Spam content',
    reporterUsername: 'user_jane_doe',
    reportedAt: '2024-05-13T10:00:00Z',
    status: 'pending',
  },
  {
    id: 'flag002',
    contentType: 'comment',
    contentSnippet: 'Another offensive remark...',
    reason: 'Hate speech',
    reporterUsername: 'user_john_smith',
    reportedAt: '2024-05-14T11:30:00Z',
    status: 'pending',
  },
];

const ContentModerationPage = () => {
  const [flaggedItems, setFlaggedItems] = useState<FlaggedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authContext = useContext(AuthContext);

  useEffect(() => {
    const fetchFlaggedContent = async () => {
      setLoading(true);
      setError(null);
      try {
        // Replace with actual API call: GET /api/admin/moderation/content/flagged
        // const response = await fetch('/api/admin/moderation/content/flagged', {
        //   headers: { 'Authorization': `Bearer ${authContext?.token}` },
        // });
        // if (!response.ok) throw new Error('Failed to fetch flagged content');
        // const data = await response.json();
        // setFlaggedItems(data.items);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
        setFlaggedItems(placeholderFlaggedContent);
      } catch (err: any) {
        setError(err.message || 'An error occurred while fetching flagged content.');
      } finally {
        setLoading(false);
      }
    };

    fetchFlaggedContent();
  }, [authContext?.token]);

  const handleReviewItem = (itemId: string, action: 'approve' | 'reject' | 'view_details') => {
    console.log(`Review item ${itemId}, action: ${action}`);
    // Implement API call to /api/admin/moderation/content/<content_id>/review
    // Update local state or re-fetch after action
  };

  if (loading) return <div className="text-center py-10">Loading flagged content...</div>;
  if (error) return <div className="text-center py-10 text-red-500">Error: {error}</div>;

  return (
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Content Moderation</h1>

      {flaggedItems.length === 0 && !loading && (
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <p className="text-gray-600">No content currently flagged for moderation.</p>
        </div>
      )}

      {flaggedItems.length > 0 && (
        <div className="bg-white shadow-md rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Content Type</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Snippet</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reported By</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reported At</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {flaggedItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.contentType.replace('_', ' ')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 max-w-xs truncate" title={item.contentSnippet}>{item.contentSnippet}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.reason}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.reporterUsername}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(item.reportedAt).toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                      {item.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onClick={() => handleReviewItem(item.id, 'view_details')} className="text-blue-600 hover:text-blue-900 mr-3">Details</button>
                    {item.status === 'pending' && (
                      <>
                        <button onClick={() => handleReviewItem(item.id, 'approve')} className="text-green-600 hover:text-green-900 mr-3">Approve</button>
                        <button onClick={() => handleReviewItem(item.id, 'reject')} className="text-red-600 hover:text-red-900">Reject</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* TODO: Add pagination if list is long */}
      {/* TODO: Add modal for viewing content details and taking action */}
    </div>
  );
};

export default ContentModerationPage;

