'use client';

import React, { useState } from 'react';
import UserListTable from '@/components/admin/UserManagement/UserListTable';
import { User } from '@/types/api';
import Link from 'next/link';

export default function UsersPage() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 -mx-6 -mt-6 mb-6 px-6 py-4 md:-mx-10 md:-mt-10 md:mb-6 md:px-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-600 mt-1">Manage system users and their roles</p>
          </div>
          <Link
            href="/admin/users/create"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            + Create User
          </Link>
        </div>
      </div>

      {/* Content */}
      <UserListTable
        onSelectUser={(user) => {
          setSelectedUser(user);
        }}
      />
    </>
  );
}