'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import UserForm from '@/components/admin/UserManagement/UserForm';

export default function CreateUserPage() {
  const router = useRouter();

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b -mx-6 -mt-6 mb-6 px-6 py-4 md:-mx-10 md:-mt-10 md:mb-6 md:px-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create User</h1>
            <p className="text-gray-600 text-sm mt-1">Add a new user to the system</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <UserForm
        onSuccess={() => router.push('/admin/users')}
        onCancel={() => router.back()}
      />
    </>
  );
}
