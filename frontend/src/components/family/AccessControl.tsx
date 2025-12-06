'use client';

import React, { useState, useEffect } from 'react';
import { FamilyService } from '@/services/family.service';
import { FamilyMember, PermissionRule, AccessRequest } from '@/types/family';

interface AccessControlProps {
  familyId: number;
}

export const AccessControl: React.FC<AccessControlProps> = ({ familyId }) => {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [permissions, setPermissions] = useState<PermissionRule[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'members' | 'permissions' | 'requests'>('members');
  const [showAddPermissionModal, setShowAddPermissionModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);

  useEffect(() => {
    fetchData();
  }, [familyId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [membersData, permissionsData, requestsData] = await Promise.all([
        FamilyService.getFamilyMembers(familyId),
        FamilyService.getPermissionRules(familyId),
        FamilyService.getPendingAccessRequests(familyId),
      ]);

      setMembers(membersData);
      setPermissions(permissionsData);
      setAccessRequests(requestsData);
      if (membersData.length > 0) {
        setSelectedMember(membersData[0]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMemberPermissions = async (member: FamilyMember) => {
    try {
      const updated = await FamilyService.updateMemberPermissions(familyId, member.id, {
        permission_level: member.permission_level,
        can_manage_children: member.can_manage_children,
        can_view_progress: member.can_view_progress,
        can_edit_settings: member.can_edit_settings,
        can_approve_enrollments: member.can_approve_enrollments,
      });

      setMembers(members.map(m => m.id === member.id ? updated : m));
      setSelectedMember(updated);
      setShowMemberModal(false);
      alert('Permissions updated successfully');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleApproveAccessRequest = async (requestId: number) => {
    try {
      await FamilyService.approveAccessRequest(familyId, requestId);
      setAccessRequests(accessRequests.filter(r => r.id !== requestId));
      alert('Access request approved');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleRejectAccessRequest = async (requestId: number, reason: string) => {
    try {
      await FamilyService.rejectAccessRequest(familyId, requestId, reason);
      setAccessRequests(accessRequests.filter(r => r.id !== requestId));
      alert('Access request rejected');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold">Access Control & Permissions</h2>
        <p className="text-purple-100 mt-2">Manage family member roles and permissions</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 bg-white rounded-lg shadow-sm p-2">
        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2 font-medium rounded ${activeTab === 'members' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}
        >
          Family Members
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`px-4 py-2 font-medium rounded ${activeTab === 'permissions' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}
        >
          Permission Rules
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 font-medium rounded ${activeTab === 'requests' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}
        >
          Access Requests ({accessRequests.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'members' && (
        <MembersTab
          members={members}
          selectedMember={selectedMember}
          onSelectMember={setSelectedMember}
          onEditMember={(member) => {
            setEditingMember(member);
            setShowMemberModal(true);
          }}
          onUpdatePermissions={handleUpdateMemberPermissions}
          loading={loading}
        />
      )}

      {activeTab === 'permissions' && (
        <PermissionsTab
          permissions={permissions}
          onAddPermission={() => setShowAddPermissionModal(true)}
        />
      )}

      {activeTab === 'requests' && (
        <RequestsTab
          requests={accessRequests}
          onApprove={handleApproveAccessRequest}
          onReject={handleRejectAccessRequest}
        />
      )}

      {/* Member Edit Modal */}
      {showMemberModal && editingMember && (
        <MemberEditModal
          member={editingMember}
          onClose={() => {
            setShowMemberModal(false);
            setEditingMember(null);
          }}
          onSave={handleUpdateMemberPermissions}
          onPermissionChange={(field, value) => {
            setEditingMember({ ...editingMember, [field]: value });
          }}
        />
      )}
    </div>
  );
};

// ========================================
// Members Tab Component
// ========================================

const MembersTab: React.FC<{
  members: FamilyMember[];
  selectedMember: FamilyMember | null;
  onSelectMember: (member: FamilyMember) => void;
  onEditMember: (member: FamilyMember) => void;
  onUpdatePermissions: (member: FamilyMember) => void;
  loading: boolean;
}> = ({ members, selectedMember, onSelectMember, onEditMember, onUpdatePermissions, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Members List */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900">Family Members ({members.length})</h3>
          </div>
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {members.map(member => (
              <button
                key={member.id}
                onClick={() => onSelectMember(member)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition ${selectedMember?.id === member.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''}`}
              >
                <p className="font-medium text-gray-900">{member.first_name} {member.last_name}</p>
                <p className="text-sm text-gray-600">{member.role_in_family}</p>
                <span className={`inline-block text-xs font-semibold px-2 py-1 rounded mt-1 ${member.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {member.is_active ? 'Active' : 'Inactive'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Member Details */}
      {selectedMember && (
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
            {/* Profile Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Member Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Full Name</p>
                  <p className="text-gray-900 font-semibold mt-1">{selectedMember.first_name} {selectedMember.last_name}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm font-medium">Email</p>
                  <p className="text-gray-900 font-semibold mt-1">{selectedMember.email}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm font-medium">Relationship</p>
                  <p className="text-gray-900 font-semibold mt-1 capitalize">{selectedMember.relationship}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm font-medium">Role</p>
                  <p className="text-gray-900 font-semibold mt-1 capitalize">{selectedMember.role_in_family}</p>
                </div>
              </div>
            </div>

            {/* Permissions Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Permissions</h3>
              <div className="space-y-3">
                {[
                  { label: 'Can Manage Children', value: selectedMember.can_manage_children },
                  { label: 'Can View Progress', value: selectedMember.can_view_progress },
                  { label: 'Can Edit Settings', value: selectedMember.can_edit_settings },
                  { label: 'Can Approve Enrollments', value: selectedMember.can_approve_enrollments },
                ].map((perm, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-gray-700 font-medium">{perm.label}</span>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${perm.value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {perm.value ? 'Granted' : 'Denied'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Permission Level */}
            <div>
              <p className="text-gray-600 text-sm font-medium mb-2">Permission Level</p>
              <div className="inline-block px-4 py-2 rounded-lg bg-blue-100 text-blue-800 font-semibold">
                {selectedMember.permission_level}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => onEditMember(selectedMember)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
              >
                Edit Permissions
              </button>
              <button className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium">
                Remove Member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ========================================
// Permissions Tab Component
// ========================================

const PermissionsTab: React.FC<{
  permissions: PermissionRule[];
  onAddPermission: () => void;
}> = ({ permissions, onAddPermission }) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Permission Rules</h3>
        <button
          onClick={onAddPermission}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
        >
          + Add Permission Rule
        </button>
      </div>

      {permissions.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600">No permission rules configured yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Resource Type</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Action</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Applies To</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map(rule => (
                <tr key={rule.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{rule.resource_type}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 capitalize">{rule.action}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${rule.is_allowed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {rule.is_allowed ? 'Allowed' : 'Denied'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {rule.member_id ? 'Specific Member' : 'All Members'}
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    <button className="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                    <button className="text-red-600 hover:text-red-800 font-medium">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ========================================
// Requests Tab Component
// ========================================

const RequestsTab: React.FC<{
  requests: AccessRequest[];
  onApprove: (id: number) => void;
  onReject: (id: number, reason: string) => void;
}> = ({ requests, onApprove, onReject }) => {
  const [rejectReasons, setRejectReasons] = useState<Record<number, string>>({});

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Access Requests ({requests.length})</h3>

      {requests.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600">No pending access requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map(request => (
            <div key={request.id} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-2">
                    Request Type: <span className="text-purple-600">{request.request_type}</span>
                  </h4>
                  {request.description && (
                    <p className="text-gray-700 mb-2">{request.description}</p>
                  )}
                  <p className="text-sm text-gray-600">
                    Requested on: {new Date(request.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                  {request.status}
                </span>
              </div>

              {request.requested_permissions && request.requested_permissions.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Requested Permissions:</p>
                  <div className="flex flex-wrap gap-2">
                    {request.requested_permissions.map((perm, idx) => (
                      <span key={idx} className="inline-block px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-800">
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => onApprove(request.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  Approve
                </button>
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    placeholder="Rejection reason..."
                    value={rejectReasons[request.id] || ''}
                    onChange={(e) => setRejectReasons({ ...rejectReasons, [request.id]: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                  <button
                    onClick={() => onReject(request.id, rejectReasons[request.id] || '')}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ========================================
// Member Edit Modal Component
// ========================================

const MemberEditModal: React.FC<{
  member: FamilyMember;
  onClose: () => void;
  onSave: (member: FamilyMember) => void;
  onPermissionChange: (field: string, value: any) => void;
}> = ({ member, onClose, onSave, onPermissionChange }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="bg-purple-600 text-white p-6 flex justify-between items-center">
          <h3 className="text-xl font-bold">Edit Member Permissions</h3>
          <button onClick={onClose} className="text-2xl hover:opacity-80">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Permission Level</label>
            <select
              value={member.permission_level}
              onChange={(e) => onPermissionChange('permission_level', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="full_access">Full Access</option>
              <option value="limited_access">Limited Access</option>
              <option value="view_only">View Only</option>
              <option value="activity_monitor">Activity Monitor</option>
            </select>
          </div>

          <div className="space-y-3">
            {[
              { field: 'can_manage_children', label: 'Can Manage Children' },
              { field: 'can_view_progress', label: 'Can View Progress' },
              { field: 'can_edit_settings', label: 'Can Edit Settings' },
              { field: 'can_approve_enrollments', label: 'Can Approve Enrollments' },
            ].map(item => (
              <label key={item.field} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={member[item.field as keyof FamilyMember] as boolean}
                  onChange={(e) => onPermissionChange(item.field, e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-gray-700 font-medium">{item.label}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => onSave(member)}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
            >
              Save Changes
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccessControl;
