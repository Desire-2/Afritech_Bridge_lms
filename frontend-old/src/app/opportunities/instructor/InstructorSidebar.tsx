"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const InstructorSidebar = () => {
  const pathname = usePathname();
  const navItems = [
    { href: '/instructor/dashboard', label: 'Overview' },
    { href: '/instructor/courses', label: 'My Courses' },
    { href: '/instructor/grading', label: 'Grading' },
    { href: '/instructor/announcements', label: 'Announcements' },
    // Add more links as needed, e.g., for communication tools or profile
  ];

  return (
    <aside className="w-64 bg-gray-800 text-white p-6 min-h-screen">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold">Instructor Panel</h2>
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

export default InstructorSidebar;

