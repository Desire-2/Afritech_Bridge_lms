"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Award, 
  CheckCircle2, 
  XCircle, 
  Shield, 
  Calendar, 
  User, 
  BookOpen,
  Loader2,
  AlertTriangle,
  GraduationCap,
  Trophy,
  Star,
  Medal
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import axios from 'axios';

interface CertificateData {
  id: number;
  certificate_number: string;
  student_name: string;
  course_title: string;
  grade: string;
  overall_score: number;
  skills_acquired: string[];
  issued_at: string;
  expires_at?: string;
  verification_status: string;
  verified_at: string;
}

export default function VerifyCertificatePage() {
  const params = useParams();
  const certificateNumber = params.certificateNumber as string;
  
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [certificate, setCertificate] = useState<CertificateData | null>(null);

  useEffect(() => {
    const verifyCertificate = async () => {
      if (!certificateNumber) {
        setError("No certificate number provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const response = await axios.get(
          `${apiUrl}/student/certificate/verify/${certificateNumber}`
        );

        if (response.data.success) {
          setVerified(true);
          setCertificate(response.data.data);
        } else {
          setError(response.data.error || "Certificate verification failed");
        }
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 404) {
            setError("Certificate not found. Please check the certificate number.");
          } else {
            setError(err.response?.data?.error || "Failed to verify certificate");
          }
        } else {
          setError("An unexpected error occurred");
        }
      } finally {
        setLoading(false);
      }
    };

    verifyCertificate();
  }, [certificateNumber]);

  const getGradeColor = (grade: string) => {
    switch (grade?.toUpperCase()) {
      case 'A+':
      case 'A':
        return 'from-yellow-400 to-amber-500';
      case 'A-':
      case 'B+':
        return 'from-blue-400 to-blue-600';
      case 'B':
      case 'B-':
        return 'from-green-400 to-green-600';
      default:
        return 'from-gray-400 to-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="py-6 px-4 border-b border-white/10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image 
              src="/logo.jpg" 
              alt="Afritech Bridge Logo" 
              width={40} 
              height={40}
              className="rounded-full"
            />
            <span className="text-white font-bold text-xl">Afritech Bridge</span>
          </Link>
          <Badge variant="outline" className="border-blue-400 text-blue-400">
            <Shield className="w-3 h-3 mr-1" />
            Certificate Verification
          </Badge>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Loading State */}
        {loading && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <Loader2 className="w-16 h-16 text-blue-400 animate-spin mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-white mb-2">Verifying Certificate</h2>
            <p className="text-gray-400">Please wait while we verify the authenticity of this certificate...</p>
          </motion.div>
        )}

        {/* Error State */}
        {!loading && error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12"
          >
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-lg mx-auto">
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-12 h-12 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Verification Failed</h2>
              <p className="text-gray-300 mb-6">{error}</p>
              <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-400">Certificate Number</p>
                <p className="font-mono text-white">{certificateNumber}</p>
              </div>
              <div className="flex justify-center gap-4">
                <Button asChild variant="outline" className="border-gray-600 text-gray-300">
                  <Link href="/">Go to Homepage</Link>
                </Button>
                <Button 
                  onClick={() => window.location.reload()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Try Again
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Verified State */}
        {!loading && verified && certificate && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Verification Banner */}
            <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <div className="text-left">
                  <h2 className="text-xl font-bold text-green-400">Certificate Verified</h2>
                  <p className="text-green-300/70 text-sm">This certificate is authentic and valid</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <Shield className="w-4 h-4" />
                <span>Verified at {new Date(certificate.verified_at).toLocaleString()}</span>
              </div>
            </div>

            {/* Certificate Details Card */}
            <Card className="bg-gray-800/50 border-gray-700 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-gray-700">
                <CardTitle className="flex items-center gap-3 text-white">
                  <Award className="w-6 h-6 text-yellow-400" />
                  Certificate of Completion
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Certificate Number */}
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Certificate Number</p>
                  <p className="font-mono text-lg text-white">{certificate.certificate_number}</p>
                </div>

                {/* Student Info */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Awarded To</p>
                      <p className="text-xl font-semibold text-white">{certificate.student_name}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-purple-600/20 rounded-full flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Course Completed</p>
                      <p className="text-xl font-semibold text-white">{certificate.course_title}</p>
                    </div>
                  </div>
                </div>

                {/* Grade and Score */}
                <div className="flex flex-wrap items-center justify-center gap-6 py-4">
                  {certificate.grade && (
                    <div className="text-center">
                      <div className={`inline-flex items-center gap-2 bg-gradient-to-r ${getGradeColor(certificate.grade)} px-6 py-2 rounded-full`}>
                        <Medal className="w-5 h-5 text-white" />
                        <span className="text-white font-bold text-lg">Grade: {certificate.grade}</span>
                      </div>
                    </div>
                  )}
                  {certificate.overall_score && (
                    <div className="text-center">
                      <div className="inline-flex items-center gap-2 bg-gray-700 px-6 py-2 rounded-full">
                        <Trophy className="w-5 h-5 text-yellow-400" />
                        <span className="text-white font-semibold">Score: {certificate.overall_score.toFixed(1)}%</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Skills */}
                {certificate.skills_acquired && certificate.skills_acquired.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Star className="w-4 h-4" />
                      Skills Demonstrated
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {certificate.skills_acquired.map((skill, index) => (
                        <Badge 
                          key={index} 
                          variant="secondary"
                          className="bg-blue-600/20 text-blue-300 border border-blue-600/30"
                        >
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dates */}
                <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-gray-700">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-400">Date Issued</p>
                      <p className="text-white">
                        {new Date(certificate.issued_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  {certificate.expires_at && (
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-400" />
                      <div>
                        <p className="text-xs text-gray-400">Expires On</p>
                        <p className="text-white">
                          {new Date(certificate.expires_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Issuing Organization */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Image 
                    src="/logo.jpg" 
                    alt="Afritech Bridge Logo" 
                    width={60} 
                    height={60}
                    className="rounded-full"
                  />
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Issued By</p>
                    <p className="text-xl font-semibold text-white">Afritech Bridge</p>
                    <p className="text-gray-400 text-sm">Empowering Africa Through Technology Education</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-center gap-4">
              <Button asChild className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                <Link href="/">
                  <GraduationCap className="w-4 h-4 mr-2" />
                  Explore Courses
                </Link>
              </Button>
            </div>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/10 mt-auto">
        <div className="max-w-4xl mx-auto text-center text-gray-400 text-sm">
          <p>© {new Date().getFullYear()} Afritech Bridge. All rights reserved.</p>
          <p className="mt-2">
            <Link href="https://study.afritechbridge.online" className="text-blue-400 hover:underline">
              study.afritechbridge.online
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
