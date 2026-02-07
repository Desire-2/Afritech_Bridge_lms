'use client';

import { useEffect, useState } from 'react';
import { Clock, Settings, Server, AlertTriangle } from 'lucide-react';
import Image from 'next/image';

interface MaintenanceInfo {
  maintenance_mode: boolean;
  message: string;
  start_time?: string;
  estimated_end_time?: string;
  show_countdown?: boolean;
  current_time: string;
}

interface TimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
}

export default function MaintenancePage() {
  const [maintenanceInfo, setMaintenanceInfo] = useState<MaintenanceInfo>({
    maintenance_mode: true,
    message: 'The system is currently undergoing maintenance. We apologize for any inconvenience. Please check back later.',
    current_time: new Date().toISOString(),
  });
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMaintenanceInfo();
    const interval = setInterval(fetchMaintenanceInfo, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (maintenanceInfo.estimated_end_time && maintenanceInfo.show_countdown) {
      const interval = setInterval(() => {
        calculateTimeRemaining();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [maintenanceInfo]);

  const fetchMaintenanceInfo = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
      const response = await fetch(`${apiUrl}/maintenance/info`);
      
      if (response.ok) {
        const data = await response.json() as MaintenanceInfo;
        setMaintenanceInfo(data);
        
        // If maintenance is off, redirect to home
        if (!data.maintenance_mode) {
          window.location.href = '/';
        }
      }
    } catch (error) {
      console.error('Failed to fetch maintenance info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTimeRemaining = () => {
    if (!maintenanceInfo.estimated_end_time) {
      setTimeRemaining(null);
      return;
    }

    const now = new Date().getTime();
    const end = new Date(maintenanceInfo.estimated_end_time).getTime();
    const difference = end - now;

    if (difference <= 0) {
      setTimeRemaining(null);
      fetchMaintenanceInfo(); // Check if maintenance is over
      return;
    }

    const hours = Math.floor(difference / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    setTimeRemaining({ hours, minutes, seconds });
  };

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      });
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Main Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8 md:p-12">
          {/* Logo/Icon */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-50 rounded-full"></div>
              <div className="relative bg-gradient-to-br from-blue-400 to-blue-600 p-6 rounded-full">
                <Settings className="w-16 h-16 text-white animate-spin-slow" />
              </div>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold text-white text-center mb-4">
            Under Maintenance
          </h1>

          {/* Message */}
          <p className="text-xl text-blue-100 text-center mb-8 leading-relaxed">
            {maintenanceInfo.message}
          </p>

          {/* Time Information */}
          <div className="space-y-4 mb-8">
            {maintenanceInfo.start_time && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center gap-3">
                <Server className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-blue-200 text-sm font-medium">Maintenance Started</p>
                  <p className="text-white">{formatDateTime(maintenanceInfo.start_time)}</p>
                </div>
              </div>
            )}

            {maintenanceInfo.estimated_end_time && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center gap-3">
                <Clock className="w-5 h-5 text-green-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-blue-200 text-sm font-medium">Expected Completion</p>
                  <p className="text-white">{formatDateTime(maintenanceInfo.estimated_end_time)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Countdown Timer */}
          {timeRemaining && maintenanceInfo.show_countdown && (
            <div className="bg-gradient-to-r from-blue-600/30 to-purple-600/30 border border-blue-400/30 rounded-xl p-6 mb-8">
              <p className="text-blue-200 text-sm font-medium text-center mb-4">Time Remaining</p>
              <div className="flex justify-center gap-4">
                <div className="text-center">
                  <div className="bg-white/10 backdrop-blur rounded-lg p-3 min-w-[80px]">
                    <p className="text-3xl font-bold text-white">{String(timeRemaining.hours).padStart(2, '0')}</p>
                    <p className="text-blue-200 text-sm mt-1">Hours</p>
                  </div>
                </div>
                <div className="text-center flex items-center">
                  <p className="text-3xl font-bold text-white">:</p>
                </div>
                <div className="text-center">
                  <div className="bg-white/10 backdrop-blur rounded-lg p-3 min-w-[80px]">
                    <p className="text-3xl font-bold text-white">{String(timeRemaining.minutes).padStart(2, '0')}</p>
                    <p className="text-blue-200 text-sm mt-1">Minutes</p>
                  </div>
                </div>
                <div className="text-center flex items-center">
                  <p className="text-3xl font-bold text-white">:</p>
                </div>
                <div className="text-center">
                  <div className="bg-white/10 backdrop-blur rounded-lg p-3 min-w-[80px]">
                    <p className="text-3xl font-bold text-white">{String(timeRemaining.seconds).padStart(2, '0')}</p>
                    <p className="text-blue-200 text-sm mt-1">Seconds</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Information Box */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-100 text-sm">
                We&apos;re working hard to improve your experience. The system will be back online shortly.
                Thank you for your patience!
              </p>
            </div>
          </div>

          {/* Action Button */}
          <div className="mt-8 text-center">
            <button
              onClick={fetchMaintenanceInfo}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition-all transform hover:scale-105 inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Check Status
            </button>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <p className="text-blue-200 text-sm">
              Need urgent assistance? Contact us at{' '}
              <a href="mailto:afritech.bridge@yahoo.com" className="text-blue-400 hover:text-blue-300 underline">
                afritech.bridge@yahoo.com
              </a>
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-blue-200 text-sm">
            Afritec Bridge LMS &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
