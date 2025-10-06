'use client';

import React from 'react';
import Image from 'next/image';
import { Award, Calendar, User, Shield, Star, Trophy, CheckCircle, Zap } from 'lucide-react';

export interface Certificate {
  id: string;
  courseTitle: string;
  completionDate: string;
  finalGrade: number;
  certificateUrl: string;
  skillsEarned: string[];
  instructor: string;
  credentialId: string;
  isVerified: boolean;
  studentName: string;
}

interface CertificateDisplayProps {
  certificate: Certificate;
  className?: string;
}

export const CertificateDisplay: React.FC<CertificateDisplayProps> = ({
  certificate,
  className = ''
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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

  const gradeBadge = getGradeBadge(certificate.finalGrade);
  const GradeBadgeIcon = gradeBadge.icon;

  return (
    <div 
      id={`certificate-${certificate.id}`}
      className={`relative bg-gradient-to-br from-white via-blue-50 to-indigo-100 rounded-2xl border-4 border-blue-200 shadow-2xl overflow-hidden ${className}`}
      style={{ minHeight: '600px', aspectRatio: '4/3' }}
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
              alt="AfriTec Bridge Logo"
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
            {certificate.studentName}
          </h2>
          <p className="text-lg text-gray-600">has successfully completed</p>
        </div>

        {/* Course Information */}
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-gray-800 mb-4 leading-tight">
            {certificate.courseTitle}
          </h3>
          
          {/* Grade Badge */}
          <div className="flex justify-center mb-4">
            <div className={`flex items-center gap-2 ${gradeBadge.color} text-white px-4 py-2 rounded-full font-bold text-lg shadow-lg`}>
              <GradeBadgeIcon className="w-5 h-5" />
              {certificate.finalGrade}% - {gradeBadge.label}
            </div>
          </div>

          {/* Skills Section */}
          {certificate.skillsEarned.length > 0 && (
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-3">Skills & Competencies Demonstrated:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {certificate.skillsEarned.slice(0, 6).map((skill, index) => (
                  <span
                    key={index}
                    className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium"
                  >
                    {skill}
                  </span>
                ))}
                {certificate.skillsEarned.length > 6 && (
                  <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm">
                    +{certificate.skillsEarned.length - 6} more
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
            <p className="font-semibold text-gray-800">{formatDate(certificate.completionDate)}</p>
          </div>

          <div className="text-center">
            <div className="flex justify-center mb-2">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-sm text-gray-600">Instructor</p>
            <p className="font-semibold text-gray-800">{certificate.instructor}</p>
          </div>

          <div className="text-center">
            <div className="flex justify-center mb-2">
              <Award className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-sm text-gray-600">Credential ID</p>
            <p className="font-mono text-sm font-semibold text-gray-800">{certificate.credentialId}</p>
          </div>
        </div>
      </div>

      {/* Footer Section */}
      <div className="relative p-6 border-t border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex justify-between items-center">
          {/* Platform Info */}
          <div className="text-left">
            <p className="font-bold text-gray-800">AfriTec Bridge LMS</p>
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
            Verify this certificate at: afritecbridge.com/verify/{certificate.credentialId}
          </p>
        </div>
      </div>

      {/* Decorative Corner Elements */}
      <div className="absolute top-0 left-0 w-16 h-16 bg-gradient-to-br from-blue-600 to-transparent rounded-br-full opacity-20"></div>
      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-indigo-600 to-transparent rounded-bl-full opacity-20"></div>
      <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr from-purple-600 to-transparent rounded-tr-full opacity-20"></div>
      <div className="absolute bottom-0 right-0 w-16 h-16 bg-gradient-to-tl from-blue-600 to-transparent rounded-tl-full opacity-20"></div>
    </div>
  );
};

export default CertificateDisplay;