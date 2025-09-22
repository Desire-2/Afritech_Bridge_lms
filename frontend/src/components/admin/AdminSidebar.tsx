"use client";

import React, { useContext, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AuthContext } from '@/contexts/AuthContext'; // Assuming AuthContext is here

const AdminSidebar = () => {
  const pathname = usePathname();
  const navItems = [
    { href: '/admin/dashboard', label: 'Overview' },
    { href: '/admin/users', label: 'User Management' },
    { href: '/admin/courses', label: 'Course Management' },
    { href: '/admin/opportunities', label: 'Opportunity Management' },
    // { href: '/admin/moderation', label: 'Content Moderation' }, // Future
    // { href: '/admin/analytics', label: 'Analytics' }, // Future
    // { href: '/admin/settings', label: 'Site Settings' }, // Future
  ];

  return (
    <aside className="w-64 bg-gray-800 text-white p-6 min-h-screen">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold">Admin Panel</h2>
      </div>
      <nav>
        <ul>
          {navItems.map((item) => (
            <li key={item.href} className="mb-3">
              <Link href={item.href} legacyBehavior>
                <a
                  className={`block py-2 px-3 rounded hover:bg-gray-700 ${
                    pathname === item.href ? 'bg-gray-900 text-white' : 'text-gray-300'
                  }`}
                >
                  {item.label}
                </a>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

export default AdminSidebar;

