'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Award, Calendar, User, Shield, Star, Trophy, CheckCircle, Zap, Lock, Unlock } from 'lucide-react';

// Union type supporting both backend API interface and display interface
export interface Certificate {
  id: string | number;
  courseTitle?: string;
  course_title?: string;
  completionDate?: string;
  issued_date?: string;
  finalGrade?: number;
  certificateUrl?: string;
  skillsEarned?: string[];
  skills_demonstrated?: string[];
  instructor?: string;
  credentialId?: string;
  certificate_number?: string;
  isVerified?: boolean;
  studentName?: string;
  student_name?: string;
  verification_url?: string;
  // New fields for completion status
  courseCompleted?: boolean;
  completionPercentage?: number;
  isLocked?: boolean;
}

interface CertificateDisplayProps {
  certificate: Certificate;
  className?: string;
  showBlurred?: boolean; // Show blurry preview
  onUnlock?: () => void; // Callback when unlocking certificate
}

export const CertificateDisplay: React.FC<CertificateDisplayProps> = ({
  certificate,
  className = '',
  showBlurred = false,
  onUnlock
}) => {
  // State for blur effect
  const [isBlurred, setIsBlurred] = useState(showBlurred || certificate.isLocked !== false);
  const [showUnlockPrompt, setShowUnlockPrompt] = useState(false);

  // Helper functions to handle both API and display data structures
  const getCourseTitle = () => certificate.courseTitle || certificate.course_title || 'Unknown Course';
  const getStudentName = () => certificate.studentName || certificate.student_name || 'Student';
  const getCredentialId = () => certificate.credentialId || certificate.certificate_number || 'N/A';
  const getCompletionDate = () => certificate.completionDate || certificate.issued_date || new Date().toISOString();
  const getSkills = () => certificate.skillsEarned || certificate.skills_demonstrated || [];
  const getInstructor = () => certificate.instructor || 'AfriTech Bridge Instructor';
  const getGrade = () => certificate.finalGrade || 85;
  const isCourseCompleted = () => certificate.courseCompleted || certificate.completionPercentage === 100 || !isBlurred;

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  const getGradeColor = (grade: number) => {
    if (grade >= 90) return 'text-green-600';
    if (grade >= 80) return 'text-blue-600';
    if (grade >= 70) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getGradeBadge = (grade: number) => {
    if (grade >= 95) return { icon: Trophy, label: 'Exceptional', color: 'bg-yellow-500' };
    if (grade >= 90) return { icon: Star, label: 'Excellent', color: 'bg-green-500' };
    if (grade >= 85) return { icon: Award, label: 'Very Good', color: 'bg-blue-500' };
    if (grade >= 80) return { icon: CheckCircle, label: 'Good', color: 'bg-purple-500' };
    return { icon: Zap, label: 'Completed', color: 'bg-gray-500' };
  };

  const finalGrade = getGrade();
  const gradeBadge = getGradeBadge(finalGrade);
  const GradeBadgeIcon = gradeBadge.icon;

  const handleUnlock = () => {
    setIsBlurred(false);
    setShowUnlockPrompt(false);
    onUnlock?.();
  };

  return (
    <div 
      id={`certificate-${certificate.id}`}
      className={`relative bg-gradient-to-br from-white via-blue-50 to-indigo-100 rounded-2xl border-4 border-blue-200 shadow-2xl overflow-hidden transition-all duration-500 ${
        isBlurred ? 'blur-sm' : 'blur-0'
      } ${className}`}
      style={{ minHeight: '600px', aspectRatio: '4/3' }}
      onMouseEnter={() => isBlurred && setShowUnlockPrompt(true)}
      onMouseLeave={() => setShowUnlockPrompt(false)}
    >
      {/* Decorative Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-10 left-10 w-32 h-32 bg-blue-600 rounded-full"></div>
        <div className="absolute top-20 right-20 w-24 h-24 bg-indigo-600 rounded-full"></div>
        <div className="absolute bottom-20 left-20 w-28 h-28 bg-purple-600 rounded-full"></div>
        <div className="absolute bottom-10 right-10 w-20 h-20 bg-blue-600 rounded-full"></div>
      </div>

      {/* Certificate Border Design */}
      <div className="absolute inset-4 border-2 border-blue-300 rounded-xl"></div>
      <div className="absolute inset-6 border border-blue-200 rounded-lg"></div>

      {/* Header Section */}
      <div className="relative p-8 text-center border-b border-blue-200">
        {/* Company Logo */}
        <div className="flex justify-center mb-4">
          <div className="relative w-20 h-20 rounded-full overflow-hidden border-4 border-blue-600 shadow-lg bg-white">
            <Image
              src="/sign.jpg"
              alt="AfriTech Bridge Logo"
              width={80}
              height={80}
              className="object-cover"
            />
          </div>
        </div>

        {/* Certificate Title */}
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Certificate of Completion
        </h1>
        <div className="w-32 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 mx-auto rounded-full"></div>
      </div>

      {/* Main Content */}
      <div className="relative p-8 flex-1">
        {/* Verification Badge */}
        {certificate.isVerified && (
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
            <Shield className="w-4 h-4" />
            Verified
          </div>
        )}

        {/* Student Name */}
        <div className="text-center mb-8">
          <p className="text-lg text-gray-600 mb-2">This is to certify that</p>
          <h2 className="text-4xl font-bold text-gray-800 mb-2 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            {getStudentName()}
          </h2>
          <p className="text-lg text-gray-600">has successfully completed</p>
        </div>

        {/* Course Information */}
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-gray-800 mb-4 leading-tight">
            {getCourseTitle()}
          </h3>
          
          {/* Grade Badge */}
          <div className="flex justify-center mb-4">
            <div className={`flex items-center gap-2 ${gradeBadge.color} text-white px-4 py-2 rounded-full font-bold text-lg shadow-lg`}>
              <GradeBadgeIcon className="w-5 h-5" />
              {finalGrade}% - {gradeBadge.label}
            </div>
          </div>

          {/* Skills Section */}
          {getSkills().length > 0 && (
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-3">Skills & Competencies Demonstrated:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {getSkills().slice(0, 6).map((skill, index) => (
                  <span
                    key={index}
                    className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium"
                  >
                    {skill}
                  </span>
                ))}
                {getSkills().length > 6 && (
                  <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm">
                    +{getSkills().length - 6} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="text-center">
            <div className="flex justify-center mb-2">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-sm text-gray-600">Completion Date</p>
            <p className="font-semibold text-gray-800">{formatDate(getCompletionDate())}</p>
          </div>

          <div className="text-center">
            <div className="flex justify-center mb-2">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-sm text-gray-600">Instructor</p>
            <p className="font-semibold text-gray-800">{getInstructor()}</p>
          </div>

          <div className="text-center">
            <div className="flex justify-center mb-2">
              <Award className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-sm text-gray-600">Credential ID</p>
            <p className="font-mono text-sm font-semibold text-gray-800">{getCredentialId()}</p>
          </div>
        </div>
      </div>

      {/* Footer Section */}
      <div className="relative p-6 border-t border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex justify-between items-center">
          {/* Platform Info */}
          <div className="text-left">
            <p className="font-bold text-gray-800">AfriTech Bridge LMS</p>
            <p className="text-sm text-gray-600">Empowering African Tech Talent</p>
          </div>

          {/* Signature */}
          <div className="text-right">
            <div className="w-24 h-16 relative mb-2">
              <Image
                src="/sign.jpg"
                alt="Signature"
                width={96}
                height={64}
                className="object-contain filter contrast-150"
              />
            </div>
            <p className="text-sm font-semibold text-gray-800">Desire Bikorimana</p>
            <p className="text-xs text-gray-600">Platform Director</p>
          </div>
        </div>

        {/* Verification URL */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            Verify this certificate at: afritecbridge.com/verify/{getCredentialId()}
          </p>
        </div>
      </div>

      {/* Decorative Corner Elements */}
      <div className="absolute top-0 left-0 w-16 h-16 bg-gradient-to-br from-blue-600 to-transparent rounded-br-full opacity-20"></div>
      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-indigo-600 to-transparent rounded-bl-full opacity-20"></div>
      <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr from-purple-600 to-transparent rounded-tr-full opacity-20"></div>
      <div className="absolute bottom-0 right-0 w-16 h-16 bg-gradient-to-tl from-blue-600 to-transparent rounded-tl-full opacity-20"></div>

      {/* Blur Overlay & Lock Icon */}
      {isBlurred && (
        <div className="absolute inset-0 bg-black/10 rounded-2xl backdrop-blur-lg flex flex-col items-center justify-center z-40">
          {/* Lock Icon */}
          <div className="mb-4 animate-bounce">
            <div className="p-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full shadow-2xl">
              <Lock className="w-12 h-12 text-white" />
            </div>
          </div>

          {/* Unlock Prompt */}
          <div className="text-center space-y-4">
            <h3 className="text-2xl font-bold text-white drop-shadow-lg">
              Certificate Locked
            </h3>
            <p className="text-sm text-white/90 drop-shadow">
              Complete the course to unlock your certificate
            </p>

            {/* Completion Status */}
            {certificate.completionPercentage !== undefined && (
              <div className="mt-6">
                <div className="w-48 h-2 bg-white/30 rounded-full overflow-hidden mx-auto">
                  <div 
                    className="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-500"
                    style={{ width: `${certificate.completionPercentage}%` }}
                  ></div>
                </div>
                <p className="text-xs text-white/80 mt-2">
                  {certificate.completionPercentage}% Complete
                </p>
              </div>
            )}

            {/* Unlock Button (if course is completed) */}
            {isCourseCompleted() && (
              <button
                onClick={handleUnlock}
                className="mt-6 px-6 py-2 bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-white font-semibold rounded-lg shadow-lg transition-all transform hover:scale-105 flex items-center gap-2 mx-auto"
              >
                <Unlock className="w-4 h-4" />
                Unlock Certificate
              </button>
            )}
          </div>

          {/* Hover to unlock hint */}
          {showUnlockPrompt && !isCourseCompleted() && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-2xl">
              <div className="text-center">
                <p className="text-white text-sm font-semibold drop-shadow-lg">
                  Continue your course to unlock
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CertificateDisplay;