"use client";

import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';

// Placeholder for SiteSettings type - define based on your actual settings structure
interface SiteSettings {
  siteName: string;
  siteLogoUrl: string;
  defaultLanguage: string;
  adminEmail: string;
  maintenanceMode: boolean;
  allowRegistrations: boolean;
}

// Placeholder data - replace with API calls
const placeholderSettings: SiteSettings = {
  siteName: 'Afritec Bridge LMS',
  siteLogoUrl: '/logo_afritec_bridge.png', // Assuming a logo in public folder
  defaultLanguage: 'en',
  adminEmail: 'admin@afritecbridge.com',
  maintenanceMode: false,
  allowRegistrations: true,
};

const SiteSettingsPage = () => {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const authContext = useContext(AuthContext);

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      setError(null);
      try {
        // Replace with actual API call: GET /api/admin/site_settings
        // const response = await fetch('/api/admin/site_settings', {
        //   headers: { 'Authorization': `Bearer ${authContext?.token}` },
        // });
        // if (!response.ok) throw new Error('Failed to fetch site settings');
        // const data = await response.json();
        // setSettings(data.settings);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
        setSettings(placeholderSettings);
      } catch (err: any) {
        setError(err.message || 'An error occurred while fetching site settings.');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [authContext?.token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let processedValue: string | boolean = value;
    if (type === 'checkbox') {
      processedValue = (e.target as HTMLInputElement).checked;
    }
    setSettings(prev => (prev ? { ...prev, [name]: processedValue } : null));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!settings) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setError(null);
    try {
      // Replace with actual API call: PUT /api/admin/site_settings
      // const response = await fetch('/api/admin/site_settings', {
      //   method: 'PUT',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${authContext?.token}`,
      //   },
      //   body: JSON.stringify(settings),
      // });
      // if (!response.ok) {
      //   const errorData = await response.json();
      //   throw new Error(errorData.message || 'Failed to save site settings');
      // }
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate save delay
      console.log('Settings saved:', settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000); // Hide success message after 3s
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="text-center py-10">Loading site settings...</div>;
  if (error && !settings) return <div className="text-center py-10 text-red-500">Error: {error}</div>;

  return (
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Site Settings</h1>
      {settings ? (
        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-8">
          {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">Error: {error}</div>}
          {saveSuccess && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">Settings saved successfully!</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="siteName" className="block text-sm font-medium text-gray-700 mb-1">Site Name</label>
              <input
                type="text"
                name="siteName"
                id="siteName"
                value={settings.siteName}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="siteLogoUrl" className="block text-sm font-medium text-gray-700 mb-1">Site Logo URL</label>
              <input
                type="text"
                name="siteLogoUrl"
                id="siteLogoUrl"
                value={settings.siteLogoUrl}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="defaultLanguage" className="block text-sm font-medium text-gray-700 mb-1">Default Language</label>
              <select
                name="defaultLanguage"
                id="defaultLanguage"
                value={settings.defaultLanguage}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="en">English</option>
                <option value="fr">French</option>
                {/* Add other languages as needed */}
              </select>
            </div>
            <div>
              <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
              <input
                type="email"
                name="adminEmail"
                id="adminEmail"
                value={settings.adminEmail}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <div className="flex items-center mt-4">
              <input
                id="maintenanceMode"
                name="maintenanceMode"
                type="checkbox"
                checked={settings.maintenanceMode}
                onChange={handleChange}
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="maintenanceMode" className="ml-2 block text-sm text-gray-900">Enable Maintenance Mode</label>
            </div>
            <div className="flex items-center mt-4">
              <input
                id="allowRegistrations"
                name="allowRegistrations"
                type="checkbox"
                checked={settings.allowRegistrations}
                onChange={handleChange}
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="allowRegistrations" className="ml-2 block text-sm text-gray-900">Allow New User Registrations</label>
            </div>
          </div>

          <div className="mt-8 text-right">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      ) : (
        <div className="text-center py-10 text-gray-500">No settings data available.</div>
      )}
      {/* Note: Actual implementation would involve fetching data from /api/admin/site_settings 
           and submitting changes via PUT request to the same endpoint. */}
    </div>
  );
};

export default SiteSettingsPage;

