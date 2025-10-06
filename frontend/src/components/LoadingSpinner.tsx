"use client";

import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  text = 'Loading...', 
  fullScreen = false,
  className = ''
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  const containerClasses = fullScreen 
    ? 'min-h-screen bg-gray-50 flex items-center justify-center'
    : 'flex items-center justify-center p-4';

  return (
    <div className={`${containerClasses} ${className}`}>
      <div className="text-center">
        <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-600 mx-auto mb-4`} />
        {text && (
          <p className="text-gray-600 text-sm">{text}</p>
        )}
      </div>
    </div>
  );
};

// Skeleton loading components
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse ${className}`}>
    <div className="bg-gray-200 rounded-lg p-4">
      <div className="h-4 bg-gray-300 rounded mb-2"></div>
      <div className="h-3 bg-gray-300 rounded w-3/4 mb-2"></div>
      <div className="h-3 bg-gray-300 rounded w-1/2"></div>
    </div>
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number; className?: string }> = ({ 
  rows = 5, 
  className = '' 
}) => (
  <div className={`animate-pulse ${className}`}>
    <div className="bg-white rounded-lg shadow">
      <div className="h-12 bg-gray-200 rounded-t-lg"></div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-t border-gray-200 p-4">
          <div className="flex items-center space-x-4">
            <div className="h-4 bg-gray-300 rounded flex-1"></div>
            <div className="h-4 bg-gray-300 rounded w-20"></div>
            <div className="h-4 bg-gray-300 rounded w-16"></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const SkeletonDashboard: React.FC = () => (
  <div className="p-6 space-y-6 animate-pulse">
    {/* Header */}
    <div className="mb-8">
      <div className="h-8 bg-gray-300 rounded w-1/3 mb-2"></div>
      <div className="h-4 bg-gray-300 rounded w-1/2"></div>
    </div>

    {/* Stats Cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg shadow p-6">
          <div className="h-6 bg-gray-300 rounded mb-2"></div>
          <div className="h-8 bg-gray-300 rounded w-2/3 mb-2"></div>
          <div className="h-4 bg-gray-300 rounded w-1/2"></div>
        </div>
      ))}
    </div>

    {/* Content Grid */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="h-6 bg-gray-300 rounded mb-4"></div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-3">
              <div className="h-12 w-12 bg-gray-300 rounded"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-300 rounded mb-1"></div>
                <div className="h-3 bg-gray-300 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="h-6 bg-gray-300 rounded mb-4"></div>
        <div className="h-48 bg-gray-300 rounded"></div>
      </div>
    </div>
  </div>
);

export default LoadingSpinner;