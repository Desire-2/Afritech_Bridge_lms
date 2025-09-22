'use client';
import React, { useState, useEffect, FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedLayout from "@/app/dashboard/layout"; // Assuming layout is in app/dashboard
import Link from "next/link";

// Basic UI components (replace with your actual UI library, e.g., shadcn/ui)
const Card = ({ children, title }: { children: React.ReactNode; title?: string }) => (
  <div className="bg-white shadow sm:rounded-lg mt-6">
    {title && (
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h3 className="text-lg leading-6 font-medium text-gray-900">{title}</h3>
      </div>
    )}
    <div className="px-4 py-5 sm:p-0">{children}</div>
  </div>
);

const DescriptionList = ({ children }: { children: React.ReactNode }) => (
  <dl className="sm:divide-y sm:divide-gray-200">{children}</dl>
);

const DescriptionListItem = ({ term, description }: { term: string; description: React.ReactNode }) => (
  <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
    <dt className="text-sm font-medium text-gray-500">{term}</dt>
    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{description || "-"}</dd>
  </div>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
  />
);

const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    {...props}
    rows={3}
    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
  />
);

const Button = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
  />
);

interface UserProfile {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  bio?: string;
  portfolio_url?: string;
  github_username?: string;
  linkedin_url?: string;
  // Add other innovator-specific fields
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api/v1";

const UserProfilePage: React.FC = () => {
  const { user: authUser, token, isLoading: authIsLoading, fetchUserProfile } = useAuth();
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authIsLoading && authUser) {
      // Use authUser directly or fetch more detailed profile if needed
      // For this example, we assume authUser contains enough, or we fetch it.
      // If your /users/me from AuthContext is already detailed, you can use that.
      // Otherwise, you might have a separate /api/v1/profile endpoint.
      setProfileData(authUser as UserProfile); // Cast for now, ensure User type in AuthContext is compatible
      setIsLoading(false);
    } else if (!authIsLoading && !authUser) {
        setIsLoading(false);
        setError("User not authenticated.");
    }
  }, [authUser, authIsLoading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (profileData) {
      setProfileData({ ...profileData, [e.target.name]: e.target.value });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profileData || !token) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/users/me`, { // Assuming /users/me is also for updates
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profileData),
      });
      const data = await response.json();
      if (response.ok) {
        setProfileData(data); // Update with response from server
        setIsEditing(false);
        await fetchUserProfile(); // Refresh user in AuthContext
      } else {
        throw new Error(data.message || "Failed to update profile.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || authIsLoading) {
    return (
      <ProtectedLayout>
        <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6 lg:px-8 text-center">
          <p>Loading profile...</p>
        </div>
      </ProtectedLayout>
    );
  }

  if (error) {
    return (
        <ProtectedLayout>
            <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6 lg:px-8 text-center text-red-600">
                <p>Error: {error}</p>
            </div>
        </ProtectedLayout>
    );
  }

  if (!profileData) {
    return (
      <ProtectedLayout>
        <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6 lg:px-8 text-center">
          <p>Could not load user profile. Please try logging in again.</p>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    //<ProtectedLayout>
      <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
          {!isEditing && (
            <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit}>
            <Card title="Edit Your Information">
              <div className="p-6 space-y-4">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">First Name</label>
                  <Input type="text" name="first_name" id="first_name" value={profileData.first_name || ""} onChange={handleInputChange} />
                </div>
                <div>
                  <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">Last Name</label>
                  <Input type="text" name="last_name" id="last_name" value={profileData.last_name || ""} onChange={handleInputChange} />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                  <Input type="email" name="email" id="email" value={profileData.email || ""} onChange={handleInputChange} disabled />
                   <p className="mt-1 text-xs text-gray-500">Email cannot be changed here.</p>
                </div>
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700">Username</label>
                  <Input type="text" name="username" id="username" value={profileData.username || ""} onChange={handleInputChange} disabled />
                  <p className="mt-1 text-xs text-gray-500">Username cannot be changed.</p>
                </div>
                <div>
                  <label htmlFor="bio" className="block text-sm font-medium text-gray-700">Bio</label>
                  <Textarea name="bio" id="bio" value={profileData.bio || ""} onChange={handleInputChange} placeholder="Tell us a bit about yourself..." />
                </div>
                <div>
                  <label htmlFor="portfolio_url" className="block text-sm font-medium text-gray-700">Portfolio URL</label>
                  <Input type="url" name="portfolio_url" id="portfolio_url" value={profileData.portfolio_url || ""} onChange={handleInputChange} placeholder="https://yourportfolio.com" />
                </div>
                <div>
                  <label htmlFor="github_username" className="block text-sm font-medium text-gray-700">GitHub Username</label>
                  <Input type="text" name="github_username" id="github_username" value={profileData.github_username || ""} onChange={handleInputChange} placeholder="yourgithubhandle" />
                </div>
                <div>
                  <label htmlFor="linkedin_url" className="block text-sm font-medium text-gray-700">LinkedIn Profile URL</label>
                  <Input type="url" name="linkedin_url" id="linkedin_url" value={profileData.linkedin_url || ""} onChange={handleInputChange} placeholder="https://linkedin.com/in/yourprofile" />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex justify-end space-x-3 pt-4">
                  <Button type="button" onClick={() => setIsEditing(false)} className="bg-gray-200 text-gray-700 hover:bg-gray-300">Cancel</Button>
                  <Button type="submit" disabled={isLoading}>{isLoading ? "Saving..." : "Save Changes"}</Button>
                </div>
              </div>
            </Card>
          </form>
        ) : (
          <Card title="Personal Information">
            <DescriptionList>
              <DescriptionListItem term="Username" description={profileData.username} />
              <DescriptionListItem term="Email address" description={profileData.email} />
              <DescriptionListItem term="First Name" description={profileData.first_name} />
              <DescriptionListItem term="Last Name" description={profileData.last_name} />
              <DescriptionListItem term="Role" description={profileData.role} />
              <DescriptionListItem term="Bio" description={profileData.bio || "Not provided"} />
              <DescriptionListItem term="Portfolio URL" description={profileData.portfolio_url ? <a href={profileData.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">{profileData.portfolio_url}</a> : "Not provided"} />
              <DescriptionListItem term="GitHub" description={profileData.github_username ? <a href={`https://github.com/${profileData.github_username}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">{profileData.github_username}</a> : "Not provided"} />
              <DescriptionListItem term="LinkedIn" description={profileData.linkedin_url ? <a href={profileData.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">{profileData.linkedin_url}</a> : "Not provided"} />
            </DescriptionList>
          </Card>
        )}

        {/* Placeholder for other profile sections like Enrolled Courses, Projects, etc. */}
        {/* <Card title="My Enrolled Courses">
          <div className="p-6">
            <p>Course enrollment information will be displayed here.</p>
             <Link href="/mylearning" className="text-indigo-600 hover:underline">View My Learning Dashboard</Link>
          </div>
        </Card> */}
      </div>
    //</ProtectedLayout>
  );
};

export default UserProfilePage;

