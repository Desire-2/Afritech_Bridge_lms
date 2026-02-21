"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AuthService } from '@/services/auth.service';
import { useAutoSave } from '@/hooks/useAutoSave';
import {
  AutoSaveIndicator,
  DraftRestoreBanner,
  PasswordStrengthBar,
} from '@/components/ui/form-components';
import {
  profileUpdateSchema,
  changePasswordSchema,
  validateField,
} from '@/lib/form-validation';
import { z } from 'zod';
import { CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, User, Lock } from 'lucide-react';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfileFormData {
  first_name: string;
  last_name: string;
  bio: string;
  phone: string;
  profile_picture_url: string;
}

interface PasswordFormData {
  old_password: string;
  new_password: string;
  confirmPassword: string;
}

const EMPTY_PROFILE: ProfileFormData = {
  first_name: '',
  last_name: '',
  bio: '',
  phone: '',
  profile_picture_url: '',
};

const EMPTY_PASSWORD: PasswordFormData = {
  old_password: '',
  new_password: '',
  confirmPassword: '',
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
      {message}
    </p>
  );
}

function CharCount({ value, max }: { value: string; max: number }) {
  const len = value.length;
  return (
    <span
      className={`text-xs tabular-nums ${
        len >= max ? 'text-red-500 font-semibold' : len > max * 0.85 ? 'text-orange-500' : 'text-slate-400'
      }`}
    >
      {len}/{max}
    </span>
  );
}

function PasswordInput({
  id,
  name,
  value,
  placeholder,
  onChange,
  onBlur,
  error,
  touched,
}: {
  id: string;
  name: string;
  value: string;
  placeholder?: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  error?: string;
  touched?: boolean;
}) {
  const [show, setShow] = useState(false);
  const hasError = Boolean(error);
  const isValid = touched && !hasError && value.length > 0;

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={show ? 'text' : 'password'}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        onBlur={onBlur}
        autoComplete="current-password"
        className={`w-full px-3 py-2 pr-20 border rounded-md text-sm focus:outline-none focus:ring-2 transition-colors dark:bg-slate-700 dark:text-white ${
          hasError
            ? 'border-red-500 focus:ring-red-400'
            : isValid
            ? 'border-green-500 focus:ring-green-400'
            : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
        }`}
      />
      <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-3">
        {hasError && <AlertCircle className="h-4 w-4 text-red-500" aria-hidden />}
        {isValid && <CheckCircle2 className="h-4 w-4 text-green-500" aria-hidden />}
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile field schemas (for real-time blur validation)
// ---------------------------------------------------------------------------

const profileFieldSchemas: Partial<Record<keyof ProfileFormData, z.ZodTypeAny>> = {
  first_name: z.string().min(1, 'First name is required').max(50, 'Max 50 characters'),
  last_name: z.string().min(1, 'Last name is required').max(50, 'Max 50 characters'),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  phone: z
    .string()
    .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,14}$/, 'Please enter a valid phone number')
    .optional()
    .or(z.literal('')),
  profile_picture_url: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
};

const passwordFieldSchemas: Partial<Record<keyof PasswordFormData, z.ZodTypeAny>> = {
  old_password: z.string().min(1, 'Current password is required'),
  new_password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/(?=.*[a-z])/, 'At least one lowercase letter')
    .regex(/(?=.*[A-Z])/, 'At least one uppercase letter')
    .regex(/(?=.*\d)/, 'At least one number'),
};

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

const ProfilePage = () => {
  const { user, refreshUser } = useAuth() as {
    user: { first_name?: string; last_name?: string; bio?: string; phone?: string; profile_picture_url?: string } | null;
    refreshUser?: () => Promise<void>;
  };

  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');

  // --- Profile form state ---
  const [profile, setProfile] = useState<ProfileFormData>(EMPTY_PROFILE);
  const [profileErrors, setProfileErrors] = useState<Partial<Record<keyof ProfileFormData, string>>>({});
  const [profileTouched, setProfileTouched] = useState<Partial<Record<keyof ProfileFormData, boolean>>>({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<ProfileFormData | null>(null);

  // --- Password form state ---
  const [passwords, setPasswords] = useState<PasswordFormData>(EMPTY_PASSWORD);
  const [passwordErrors, setPasswordErrors] = useState<Partial<Record<keyof PasswordFormData, string>>>({});
  const [passwordTouched, setPasswordTouched] = useState<Partial<Record<keyof PasswordFormData, boolean>>>({});
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Hydrate from AuthContext user
  useEffect(() => {
    if (user) {
      setProfile({
        first_name: (user as { first_name?: string }).first_name ?? '',
        last_name: (user as { last_name?: string }).last_name ?? '',
        bio: (user as { bio?: string }).bio ?? '',
        phone: (user as { phone?: string }).phone ?? '',
        profile_picture_url: (user as { profile_picture_url?: string }).profile_picture_url ?? '',
      });
    }
  }, [user]);

  // --- Auto-save profile draft ---
  const { status: saveStatus, lastSaved, clearDraft } = useAutoSave<ProfileFormData>({
    key: 'instructor_profile',
    data: profile,
    debounceMs: 1500,
    onRestore: (draft) => {
      setPendingDraft(draft);
      setShowDraftBanner(true);
    },
  });

  // --- Profile blur validation ---
  const handleProfileBlur = useCallback((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfileTouched((prev) => ({ ...prev, [name]: true }));
    const schema = profileFieldSchemas[name as keyof ProfileFormData];
    if (schema) {
      setProfileErrors((prev) => ({ ...prev, [name]: validateField(schema, value) }));
    }
  }, []);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
    if (profileTouched[name as keyof ProfileFormData]) {
      const schema = profileFieldSchemas[name as keyof ProfileFormData];
      if (schema) setProfileErrors((prev) => ({ ...prev, [name]: validateField(schema, value) }));
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = profileUpdateSchema.safeParse(profile);
    if (!result.success) {
      const errs: Partial<Record<keyof ProfileFormData, string>> = {};
      result.error.errors.forEach((err) => {
        const key = err.path[0] as keyof ProfileFormData;
        if (!errs[key]) errs[key] = err.message;
      });
      setProfileErrors(errs);
      setProfileTouched(
        Object.keys(EMPTY_PROFILE).reduce((a, k) => ({ ...a, [k]: true }), {})
      );
      return;
    }

    setProfileSaving(true);
    try {
      await AuthService.updateProfile(profile);
      if (refreshUser) await refreshUser();
      clearDraft();
      setProfileSuccess(true);
      toast.success('Profile updated successfully');
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? 'Failed to update profile';
      toast.error(msg);
    } finally {
      setProfileSaving(false);
    }
  };

  // --- Password ---
  const handlePasswordBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordTouched((prev) => ({ ...prev, [name]: true }));
    const schema = passwordFieldSchemas[name as keyof PasswordFormData];
    if (schema) {
      setPasswordErrors((prev) => ({ ...prev, [name]: validateField(schema, value) }));
    }
    if (name === 'confirmPassword') {
      setPasswordErrors((prev) => ({
        ...prev,
        confirmPassword: value !== passwords.new_password ? "Passwords don't match" : undefined,
      }));
    }
  }, [passwords.new_password]);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswords((prev) => ({ ...prev, [name]: value }));
    if (passwordTouched[name as keyof PasswordFormData]) {
      const schema = passwordFieldSchemas[name as keyof PasswordFormData];
      if (schema) setPasswordErrors((prev) => ({ ...prev, [name]: validateField(schema, value) }));
      if (name === 'confirmPassword' || name === 'new_password') {
        const confirm = name === 'confirmPassword' ? value : passwords.confirmPassword;
        const newPw = name === 'new_password' ? value : passwords.new_password;
        setPasswordErrors((prev) => ({
          ...prev,
          confirmPassword: confirm && confirm !== newPw ? "Passwords don't match" : undefined,
        }));
      }
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = changePasswordSchema.safeParse(passwords);
    if (!result.success) {
      const errs: Partial<Record<keyof PasswordFormData, string>> = {};
      result.error.errors.forEach((err) => {
        const key = err.path[0] as keyof PasswordFormData;
        if (!errs[key]) errs[key] = err.message;
      });
      setPasswordErrors(errs);
      setPasswordTouched(Object.keys(EMPTY_PASSWORD).reduce((a, k) => ({ ...a, [k]: true }), {}));
      return;
    }

    setPasswordSaving(true);
    try {
      await AuthService.changePassword(passwords.old_password, passwords.new_password);
      setPasswords(EMPTY_PASSWORD);
      setPasswordTouched({});
      setPasswordErrors({});
      toast.success('Password changed successfully');
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? 'Failed to change password';
      toast.error(msg);
    } finally {
      setPasswordSaving(false);
    }
  };

  const inputClass = (name: keyof ProfileFormData) =>
    `w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 transition-colors dark:bg-slate-700 dark:text-white ${
      profileErrors[name]
        ? 'border-red-500 focus:ring-red-400'
        : profileTouched[name] && !profileErrors[name]
        ? 'border-green-500 focus:ring-green-400'
        : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
    }`;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Profile</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">Manage your personal information and account security.</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {(['profile', 'password'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {tab === 'profile' ? <User className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {tab === 'profile' ? 'Personal Info' : 'Security'}
          </button>
        ))}
      </div>

      {/* ---- Profile Tab ---- */}
      {activeTab === 'profile' && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-5">
          {showDraftBanner && (
            <DraftRestoreBanner
              onRestore={() => {
                if (pendingDraft) setProfile(pendingDraft);
                setShowDraftBanner(false);
              }}
              onDiscard={() => {
                clearDraft();
                setShowDraftBanner(false);
              }}
            />
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Personal Information</h2>
            <AutoSaveIndicator status={saveStatus} lastSaved={lastSaved} />
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-5" noValidate>
            {/* Name row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* First name */}
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  value={profile.first_name}
                  onChange={handleProfileChange}
                  onBlur={handleProfileBlur}
                  maxLength={50}
                  className={inputClass('first_name')}
                  placeholder="Jane"
                />
                <FieldError message={profileErrors.first_name} />
              </div>

              {/* Last name */}
              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  value={profile.last_name}
                  onChange={handleProfileChange}
                  onBlur={handleProfileBlur}
                  maxLength={50}
                  className={inputClass('last_name')}
                  placeholder="Doe"
                />
                <FieldError message={profileErrors.last_name} />
              </div>
            </div>

            {/* Bio */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="bio" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Bio
                </label>
                <CharCount value={profile.bio} max={500} />
              </div>
              <textarea
                id="bio"
                name="bio"
                value={profile.bio}
                onChange={handleProfileChange}
                onBlur={handleProfileBlur}
                rows={3}
                maxLength={500}
                className={`${inputClass('bio')} resize-none`}
                placeholder="Tell students a bit about yourself…"
              />
              <FieldError message={profileErrors.bio} />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={profile.phone}
                onChange={handleProfileChange}
                onBlur={handleProfileBlur}
                className={inputClass('phone')}
                placeholder="+1 555 000 0000"
              />
              <FieldError message={profileErrors.phone} />
            </div>

            {/* Profile picture URL */}
            <div>
              <label htmlFor="profile_picture_url" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Profile Picture URL
              </label>
              <input
                id="profile_picture_url"
                name="profile_picture_url"
                type="url"
                value={profile.profile_picture_url}
                onChange={handleProfileChange}
                onBlur={handleProfileBlur}
                className={inputClass('profile_picture_url')}
                placeholder="https://example.com/avatar.jpg"
              />
              <FieldError message={profileErrors.profile_picture_url} />
            </div>

            {profileSuccess && (
              <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                Profile updated successfully
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={profileSaving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {profileSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {profileSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---- Security Tab ---- */}
      {activeTab === 'password' && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Change Password</h2>

          <form onSubmit={handlePasswordSubmit} className="space-y-5" noValidate>
            {/* Current password */}
            <div>
              <label htmlFor="old_password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Current Password <span className="text-red-500">*</span>
              </label>
              <PasswordInput
                id="old_password"
                name="old_password"
                value={passwords.old_password}
                placeholder="Enter current password"
                onChange={handlePasswordChange}
                onBlur={handlePasswordBlur}
                error={passwordErrors.old_password}
                touched={passwordTouched.old_password}
              />
              <FieldError message={passwordErrors.old_password} />
            </div>

            {/* New password */}
            <div>
              <label htmlFor="new_password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                New Password <span className="text-red-500">*</span>
              </label>
              <PasswordInput
                id="new_password"
                name="new_password"
                value={passwords.new_password}
                placeholder="At least 8 characters"
                onChange={handlePasswordChange}
                onBlur={handlePasswordBlur}
                error={passwordErrors.new_password}
                touched={passwordTouched.new_password}
              />
              <PasswordStrengthBar password={passwords.new_password} className="mt-2" />
              <FieldError message={passwordErrors.new_password} />
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Confirm New Password <span className="text-red-500">*</span>
              </label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                value={passwords.confirmPassword}
                placeholder="Repeat new password"
                onChange={handlePasswordChange}
                onBlur={handlePasswordBlur}
                error={passwordErrors.confirmPassword}
                touched={passwordTouched.confirmPassword}
              />
              <FieldError message={passwordErrors.confirmPassword} />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={passwordSaving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {passwordSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {passwordSaving ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
