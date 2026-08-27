"use client";
import { useState } from 'react';
import InstructorAvailabilityPage from '../availability/page';
import InstructorSessionsPage from '../sessions/page';

const TABS = [
  { id: 'availability', label: 'Availability' },
  { id: 'sessions', label: 'Sessions' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function InstructorBookingPage() {
  const [activeTab, setActiveTab] = useState<TabId>('availability');

  return (
    <>
      <div className="max-w-5xl mx-auto px-4 pt-8">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg mb-4 w-fit">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'availability' ? <InstructorAvailabilityPage /> : <InstructorSessionsPage />}
    </>
  );
}
