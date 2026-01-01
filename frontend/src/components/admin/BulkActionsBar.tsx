import React, { useState } from 'react';

interface BulkActionsBarProps {
  selectedCount: number;
  onBulkAction: (action: string, data?: any) => void;
  onClearSelection: () => void;
}

const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  onBulkAction,
  onClearSelection
}) => {
  const [showRoleSelect, setShowRoleSelect] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');

  const handleChangeRole = () => {
    if (!selectedRole) return;
    onBulkAction('change_role', { role_name: selectedRole });
    setShowRoleSelect(false);
    setSelectedRole('');
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <span className="text-blue-900 font-semibold">
          {selectedCount} user{selectedCount !== 1 ? 's' : ''} selected
        </span>
        <button
          onClick={onClearSelection}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
        >
          Clear Selection
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onBulkAction('activate')}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm transition-colors"
        >
          ✓ Activate
        </button>
        
        <button
          onClick={() => onBulkAction('deactivate')}
          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium text-sm transition-colors"
        >
          ⏸️ Deactivate
        </button>

        <div className="relative">
          {!showRoleSelect ? (
            <button
              onClick={() => setShowRoleSelect(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors"
            >
              🔄 Change Role
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Role...</option>
                <option value="student">Student</option>
                <option value="instructor">Instructor</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={handleChangeRole}
                disabled={!selectedRole}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
              >
                Apply
              </button>
              <button
                onClick={() => {
                  setShowRoleSelect(false);
                  setSelectedRole('');
                }}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg font-medium text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => {
            if (confirm(`Are you sure you want to delete ${selectedCount} user(s)?`)) {
              onBulkAction('delete');
            }
          }}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition-colors"
        >
          🗑️ Delete
        </button>
      </div>
    </div>
  );
};

export default BulkActionsBar;
