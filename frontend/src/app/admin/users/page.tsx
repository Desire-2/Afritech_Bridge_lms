"use client";

import React, { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import { AuthContext } from '@/contexts/AuthContext';

// Placeholder for User type - define based on your actual User model
interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: string;
}

// Placeholder data - replace with API calls
const placeholderUsers: User[] = [
  {
    id: '1',
    username: 'admin_user',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    createdAt: '2023-01-15T10:00:00Z',
  },
  {
    id: '2',
    username: 'instructor_jane',
    email: 'jane.doe@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    role: 'instructor',
    createdAt: '2023-02-20T14:30:00Z',
  },
  {
    id: '3',
    username: 'student_john',
    email: 'john.smith@example.com',
    firstName: 'John',
    lastName: 'Smith',
    role: 'student',
    createdAt: '2023-03-10T09:15:00Z',
  },
];

const UserManagementPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authContext = useContext(AuthContext);

  useEffect(() => {
    // Simulate API call
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        // In a real app, you would fetch from an API endpoint like /api/admin/users
        // const response = await fetch('/api/admin/users', {
        //   headers: {
        //     'Authorization': `Bearer ${authContext?.token}` // Assuming token-based auth
        //   }
        // });
        // if (!response.ok) {
        //   throw new Error('Failed to fetch users');
        // }
        // const data = await response.json();
        // setUsers(data.users);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
        setUsers(placeholderUsers);
      } catch (err: any) {
        setError(err.message || 'An error occurred while fetching users.');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [authContext?.token]);

  // Placeholder functions for actions - to be implemented with modals/forms
  const handleAddUser = () => {
    console.log('Add new user clicked');
    // Open modal or navigate to a new user form page
  };

  const handleEditUser = (userId: string) => {
    console.log(`Edit user ${userId} clicked`);
    // Open modal with user data or navigate to edit page
  };

  const handleDeleteUser = (userId: string) => {
    console.log(`Delete user ${userId} clicked`);
    // Show confirmation dialog and then call API to delete
  };

  if (loading) {
    return <div className="text-center py-10">Loading users...</div>;
  }

  if (error) {
    return <div className="text-center py-10 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">User Management</h1>
        <button
          onClick={handleAddUser}
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150"
        >
          Add New User
        </button>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">No users found.</td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.username}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{`${user.firstName} ${user.lastName}`}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin' ? 'bg-red-100 text-red-800' : user.role === 'instructor' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onClick={() => handleEditUser(user.id)} className="text-indigo-600 hover:text-indigo-900 mr-3">Edit</button>
                    <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:text-red-900">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* TODO: Add pagination if user list is long */}
      {/* TODO: Add modals/forms for Add/Edit User */}
    </div>
  );
};

export default UserManagementPage;

