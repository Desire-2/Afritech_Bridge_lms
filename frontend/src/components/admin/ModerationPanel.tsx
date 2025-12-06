'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AdminSidebar from './AdminSidebar';
import AdminBreadcrumb from './AdminBreadcrumb';

interface ModerationItem {
  id: number;
  type: 'course' | 'comment' | 'review' | 'user' | 'report';
  title: string;
  content: string;
  author: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  reason?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

interface UserReport {
  id: number;
  reportedUser: string;
  reportedBy: string;
  reason: string;
  description: string;
  evidence?: string;
  createdAt: string;
  status: 'new' | 'investigating' | 'resolved' | 'dismissed';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const ModerationPanel = () => {
  const [moderationQueue, setModerationQueue] = useState<ModerationItem[]>([]);
  const [userReports, setUserReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'queue' | 'reports' | 'settings'>('queue');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [filterType, setFilterType] = useState<'all' | 'course' | 'comment' | 'review' | 'user' | 'report'>('all');
  const [selectedItem, setSelectedItem] = useState<ModerationItem | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Mock data - replace with API calls
  const mockModerationQueue: ModerationItem[] = [
    {
      id: 1,
      type: 'course',
      title: 'Advanced Python Programming',
      content: 'This course teaches advanced Python concepts including decorators, metaclasses, and async programming.',
      author: 'john_doe',
      createdAt: '2025-11-02T14:30:00Z',
      status: 'pending',
      priority: 'high',
    },
    {
      id: 2,
      type: 'review',
      title: 'Great course!',
      content: 'This course exceeded my expectations. The instructor is knowledgeable and the material is well-organized.',
      author: 'jane_smith',
      createdAt: '2025-11-02T10:15:00Z',
      status: 'pending',
      priority: 'low',
    },
    {
      id: 3,
      type: 'comment',
      title: 'Question about lesson 5',
      content: 'I have a question about the examples in lesson 5. Can someone clarify?',
      author: 'student123',
      createdAt: '2025-11-01T16:45:00Z',
      status: 'flagged',
      priority: 'medium',
    },
  ];

  const mockUserReports: UserReport[] = [
    {
      id: 1,
      reportedUser: 'inappropriate_user',
      reportedBy: 'user456',
      reason: 'Harassment',
      description: 'This user posted offensive comments in the course forum.',
      severity: 'high',
      createdAt: '2025-11-02T12:00:00Z',
      status: 'investigating',
    },
    {
      id: 2,
      reportedUser: 'spam_account',
      reportedBy: 'user789',
      reason: 'Spam',
      description: 'Account posting promotional content repeatedly.',
      severity: 'medium',
      createdAt: '2025-11-02T08:30:00Z',
      status: 'new',
    },
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      setModerationQueue(mockModerationQueue);
      setUserReports(mockUserReports);
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const breadcrumbs = [
    { label: 'Admin', href: '/admin' },
    { label: 'Moderation', href: '/admin/moderation', active: true },
  ];

  const handleApprove = useCallback((item: ModerationItem) => {
    setModerationQueue((queue) =>
      queue.map((i) =>
        i.id === item.id ? { ...i, status: 'approved' as const } : i
      )
    );
    setShowDetails(false);
    setSelectedItem(null);
  }, []);

  const handleReject = useCallback((item: ModerationItem, reason: string) => {
    setModerationQueue((queue) =>
      queue.map((i) =>
        i.id === item.id ? { ...i, status: 'rejected' as const, reason } : i
      )
    );
    setShowDetails(false);
    setSelectedItem(null);
    setRejectionReason('');
  }, []);

  const handleFlag = useCallback((item: ModerationItem) => {
    setModerationQueue((queue) =>
      queue.map((i) =>
        i.id === item.id ? { ...i, status: 'flagged' as const } : i
      )
    );
  }, []);

  const filteredQueue = moderationQueue.filter((item) => {
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    if (filterType !== 'all' && item.type !== filterType) return false;
    return true;
  });

  const pendingCount = moderationQueue.filter((item) => item.status === 'pending').length;
  const flaggedCount = moderationQueue.filter((item) => item.status === 'flagged').length;
  const newReportsCount = userReports.filter((report) => report.status === 'new').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-6">
          <AdminBreadcrumb items={breadcrumbs} />
          <h1 className="text-3xl font-bold text-gray-900 mt-2">Content Moderation</h1>
          <p className="text-gray-600 mt-1">Review and manage user-generated content</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-gray-600 text-sm font-medium">Pending Review</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">{pendingCount}</p>
              <p className="text-xs text-gray-500 mt-1">Items waiting for review</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-gray-600 text-sm font-medium">Flagged</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{flaggedCount}</p>
              <p className="text-xs text-gray-500 mt-1">Requires attention</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-gray-600 text-sm font-medium">User Reports</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{newReportsCount}</p>
              <p className="text-xs text-gray-500 mt-1">New reports</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-gray-600 text-sm font-medium">Approved Today</p>
              <p className="text-3xl font-bold text-green-600 mt-2">12</p>
              <p className="text-xs text-gray-500 mt-1">Approved content</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200 mb-6">
            {[
              { id: 'queue', label: `Moderation Queue (${filteredQueue.length})` },
              { id: 'reports', label: `User Reports (${userReports.length})` },
              { id: 'settings', label: 'Moderation Settings' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-6 py-3 font-medium border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Moderation Queue Tab */}
          {activeTab === 'queue' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-3 mb-4">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="course">Course</option>
                  <option value="comment">Comment</option>
                  <option value="review">Review</option>
                </select>
              </div>

              {/* Queue Items */}
              <div className="space-y-3">
                {filteredQueue.length === 0 ? (
                  <div className="bg-white rounded-lg p-6 text-center">
                    <p className="text-gray-600">No items to moderate</p>
                  </div>
                ) : (
                  filteredQueue.map((item) => (
                    <div
                      key={item.id}
                      className={`bg-white rounded-lg p-4 border-l-4 cursor-pointer hover:shadow-md transition ${
                        item.priority === 'urgent'
                          ? 'border-red-600'
                          : item.priority === 'high'
                          ? 'border-orange-600'
                          : item.priority === 'medium'
                          ? 'border-yellow-600'
                          : 'border-blue-600'
                      }`}
                      onClick={() => {
                        setSelectedItem(item);
                        setShowDetails(true);
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex gap-2 items-center">
                            <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-100 text-gray-700">
                              {item.type}
                            </span>
                            <span className={`text-xs font-semibold px-2 py-1 rounded ${
                              item.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : item.status === 'approved'
                                ? 'bg-green-100 text-green-800'
                                : item.status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {item.status}
                            </span>
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 mt-2">{item.title}</h3>
                          <p className="text-gray-600 text-sm mt-1 line-clamp-2">{item.content}</p>
                          <div className="flex gap-4 mt-2 text-xs text-gray-500">
                            <span>by {item.author}</span>
                            <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="ml-4 flex gap-2">
                          {item.status === 'pending' && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApprove(item);
                                }}
                                className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                              >
                                Approve
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedItem(item);
                                  setShowDetails(true);
                                }}
                                className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* User Reports Tab */}
          {activeTab === 'reports' && (
            <div className="space-y-3">
              {userReports.length === 0 ? (
                <div className="bg-white rounded-lg p-6 text-center">
                  <p className="text-gray-600">No reports</p>
                </div>
              ) : (
                userReports.map((report) => (
                  <div
                    key={report.id}
                    className={`bg-white rounded-lg p-4 border-l-4 ${
                      report.severity === 'critical'
                        ? 'border-red-600'
                        : report.severity === 'high'
                        ? 'border-orange-600'
                        : report.severity === 'medium'
                        ? 'border-yellow-600'
                        : 'border-blue-600'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex gap-2 items-center">
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${
                            report.status === 'new'
                              ? 'bg-red-100 text-red-800'
                              : report.status === 'investigating'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {report.status.toUpperCase()}
                          </span>
                          <span className="text-xs font-semibold px-2 py-1 rounded bg-red-100 text-red-800">
                            {report.severity}
                          </span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mt-2">
                          Report: {report.reportedUser}
                        </h3>
                        <p className="text-gray-600 text-sm mt-1"><strong>Reason:</strong> {report.reason}</p>
                        <p className="text-gray-600 text-sm mt-1">{report.description}</p>
                        <div className="flex gap-4 mt-2 text-xs text-gray-500">
                          <span>Reported by: {report.reportedBy}</span>
                          <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <select
                          defaultValue={report.status}
                          className="px-3 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="new">New</option>
                          <option value="investigating">Investigating</option>
                          <option value="resolved">Resolved</option>
                          <option value="dismissed">Dismissed</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Moderation Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-gray-700">Auto-flag suspicious content</label>
                  <input type="checkbox" defaultChecked className="w-4 h-4" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-gray-700">Require approval for new users</label>
                  <input type="checkbox" defaultChecked className="w-4 h-4" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-gray-700">Enable spam detection</label>
                  <input type="checkbox" defaultChecked className="w-4 h-4" />
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <label className="block text-gray-700 font-medium mb-2">Prohibited Keywords</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    rows={4}
                    placeholder="Enter prohibited keywords (one per line)"
                    defaultValue="keyword1&#10;keyword2&#10;keyword3"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Details Modal */}
        {showDetails && selectedItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{selectedItem.title}</h2>
              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Content</p>
                  <p className="text-gray-900 mt-1">{selectedItem.content}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Author</p>
                    <p className="text-gray-900">{selectedItem.author}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Type</p>
                    <p className="text-gray-900 capitalize">{selectedItem.type}</p>
                  </div>
                </div>
              </div>

              {selectedItem.status === 'pending' && (
                <div className="space-y-3">
                  {rejectionReason && (
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Reason for rejection"
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                      rows={3}
                    />
                  )}
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowDetails(false)}
                      className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleReject(selectedItem, rejectionReason)}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(selectedItem)}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ModerationPanel;
