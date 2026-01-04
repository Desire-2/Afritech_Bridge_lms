'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AuthService } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  required?: boolean;
}

export function ChangePasswordModal({ isOpen, onClose, required = false }: ChangePasswordModalProps) {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const passwordStrength = (password: string) => {
    if (password.length < 6) return { level: 'weak', text: 'Too short', color: 'bg-red-500' };
    if (password.length < 8) return { level: 'medium', text: 'Medium', color: 'bg-yellow-500' };
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return { level: 'medium', text: 'Add uppercase, lowercase & numbers', color: 'bg-yellow-500' };
    }
    return { level: 'strong', text: 'Strong', color: 'bg-green-500' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validation
    if (formData.newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.newPassword === formData.currentPassword) {
      setError('New password must be different from current password');
      return;
    }

    setLoading(true);

    try {
      const response = await AuthService.changePassword({
        current_password: formData.currentPassword,
        new_password: formData.newPassword,
      });

      setSuccess(true);
      
      // Update user context to clear must_change_password flag
      if (user) {
        updateUser({ ...user, must_change_password: false });
      }

      // Close modal after 2 seconds if not required
      if (!required) {
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        // Refresh page to apply changes for required password change
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to change password. Please check your current password.');
    } finally {
      setLoading(false);
    }
  };

  const strength = passwordStrength(formData.newPassword);

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={required ? undefined : onClose}
    >
      <DialogContent 
        className={`max-w-md ${required ? 'pointer-events-auto' : ''}`}
        onInteractOutside={(e) => {
          if (required) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 rounded-full">
              <Lock className="h-5 w-5 text-indigo-600" />
            </div>
            <DialogTitle>
              {required ? 'Password Change Required' : 'Change Password'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm">
            {required
              ? 'For security reasons, you must change your temporary password before continuing. This is a one-time requirement.'
              : 'Create a strong password to keep your account secure. Make sure to use a combination of letters, numbers, and symbols.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="currentPassword" className="text-sm font-medium">
              Current Password *
            </Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrentPassword ? 'text' : 'password'}
                value={formData.currentPassword}
                onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                required
                placeholder="Enter your current password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-sm font-medium">
              New Password *
            </Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                required
                placeholder="Enter new password (min 6 characters)"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {formData.newPassword && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${strength.color} ${
                        strength.level === 'weak'
                          ? 'w-1/3'
                          : strength.level === 'medium'
                          ? 'w-2/3'
                          : 'w-full'
                      }`}
                    />
                  </div>
                  <span className="text-xs text-gray-600 font-medium">{strength.text}</span>
                </div>
                <p className="text-xs text-gray-500">
                  Use uppercase, lowercase, numbers, and symbols for a stronger password
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm New Password *
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                placeholder="Re-enter new password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
              <p className="text-xs text-red-500">Passwords do not match</p>
            )}
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="animate-in fade-in-50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Alert */}
          {success && (
            <Alert className="bg-green-50 text-green-900 border-green-200 animate-in fade-in-50">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                ✅ Password changed successfully! {required && 'Refreshing page...'}
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2">
            {!required && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose} 
                disabled={loading || success}
              >
                Cancel
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={loading || success || formData.newPassword !== formData.confirmPassword}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {loading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Changing...
                </>
              ) : (
                'Change Password'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
