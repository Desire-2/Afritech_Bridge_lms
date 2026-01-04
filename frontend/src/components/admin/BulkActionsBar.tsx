import React, { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface BulkActionsBarProps {
  selectedCount: number;
  onBulkAction: (action: string, data?: any) => Promise<void>;
  onClearSelection: () => void;
}

const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  onBulkAction,
  onClearSelection
}) => {
  const [showRoleSelect, setShowRoleSelect] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);

  const handleBulkActionWithLoading = async (action: string, data?: any) => {
    try {
      setIsLoading(true);
      await onBulkAction(action, data);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeRole = async () => {
    if (!selectedRole) return;
    await handleBulkActionWithLoading('change_role', { role_name: selectedRole });
    setShowRoleSelect(false);
    setSelectedRole('');
  };

  const handleDelete = async () => {
    setShowDeleteDialog(false);
    await handleBulkActionWithLoading('delete');
  };

  const handleDeactivate = async () => {
    setShowDeactivateDialog(false);
    await handleBulkActionWithLoading('deactivate');
  };

  return (
    <>
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                {selectedCount}
              </div>
              <span className="text-blue-900 font-semibold">
                user{selectedCount !== 1 ? 's' : ''} selected
              </span>
            </div>
            <Button
              onClick={onClearSelection}
              variant="ghost"
              size="sm"
              disabled={isLoading}
              className="text-blue-600 hover:text-blue-800 hover:bg-blue-100"
            >
              Clear Selection
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {isLoading && (
              <div className="flex items-center gap-2 text-blue-600 mr-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm font-medium">Processing...</span>
              </div>
            )}

            <Button
              onClick={() => handleBulkActionWithLoading('activate')}
              disabled={isLoading}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              ✓ Activate
            </Button>
            
            <Button
              onClick={() => setShowDeactivateDialog(true)}
              disabled={isLoading}
              size="sm"
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              ⏸️ Deactivate
            </Button>

            <div className="relative">
              {!showRoleSelect ? (
                <Button
                  onClick={() => setShowRoleSelect(true)}
                  disabled={isLoading}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  🔄 Change Role
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger className="w-[150px] h-9">
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="instructor">Instructor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleChangeRole}
                    disabled={!selectedRole || isLoading}
                    size="sm"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowRoleSelect(false);
                      setSelectedRole('');
                    }}
                    disabled={isLoading}
                    variant="outline"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            <Button
              onClick={() => setShowDeleteDialog(true)}
              disabled={isLoading}
              size="sm"
              variant="destructive"
            >
              🗑️ Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} User{selectedCount !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected user{selectedCount !== 1 ? 's' : ''} and all associated data including:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>User profiles and authentication</li>
                <li>Course enrollments and progress</li>
                <li>Submissions and certificates</li>
                <li>All related records</li>
              </ul>
              <p className="mt-3 font-semibold text-red-600">Note: Instructors with courses cannot be deleted.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete {selectedCount} User{selectedCount !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {selectedCount} User{selectedCount !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will prevent the selected user{selectedCount !== 1 ? 's' : ''} from logging in. They can be reactivated later.
              <p className="mt-2">Deactivated users will:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Lose access to their account</li>
                <li>Keep all their data intact</li>
                <li>Be able to be reactivated anytime</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} className="bg-yellow-600 hover:bg-yellow-700">
              Deactivate {selectedCount} User{selectedCount !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BulkActionsBar;
