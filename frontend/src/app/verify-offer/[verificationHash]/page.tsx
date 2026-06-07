"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Shield,
  Calendar,
  User,
  Briefcase,
  Loader2,
  AlertTriangle,
  GraduationCap,
  ExternalLink,
  Hash,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import axios from 'axios';

interface VerificationResult {
  offer_number: string;
  is_authentic: boolean;
  message: string;
  status: string;
  candidate_name: string;
  track_name: string;
  issued_date: string;
}

export default function VerifyOfferPage() {
  const params = useParams();
  const verificationHash = params.verificationHash as string;

  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);

  useEffect(() => {
    const verifyOffer = async () => {
      if (!verificationHash) {
        setError("No verification code provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const response = await axios.get(
          `${apiUrl}/internships/offers/verify/${verificationHash}`
        );

        if (response.data.success) {
          setVerified(response.data.data.is_authentic);
          setResult(response.data.data);
        } else {
          setError(response.data.error || "Offer verification failed");
        }
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 404) {
            setError("Offer letter not found. Please check the verification link.");
          } else {
            setError(err.response?.data?.error || "Failed to verify offer letter");
          }
        } else {
          setError("An unexpected error occurred");
        }
      } finally {
        setLoading(false);
      }
    };

    verifyOffer();
  }, [verificationHash]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return <Badge className="bg-green-600/20 text-green-400 border-green-600/30">Accepted</Badge>;
      case 'declined':
        return <Badge className="bg-red-600/20 text-red-400 border-red-600/30">Declined</Badge>;
      case 'revoked':
        return <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30">Revoked</Badge>;
      default:
        return <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30">Sent</Badge>;
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
          <Badge variant="outline" className="border-teal-400 text-teal-400">
            <Shield className="w-3 h-3 mr-1" />
            Offer Letter Verification
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
            <Loader2 className="w-16 h-16 text-teal-400 animate-spin mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-white mb-2">Verifying Offer Letter</h2>
            <p className="text-gray-400">Please wait while we verify the authenticity of this offer letter...</p>
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
                <p className="text-sm text-gray-400">Verification Code</p>
                <p className="font-mono text-white text-sm break-all">{verificationHash}</p>
              </div>
              <div className="flex justify-center gap-4">
                <Button asChild variant="outline" className="border-gray-600 text-gray-300">
                  <Link href="/">Go to Homepage</Link>
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  Try Again
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Verified State */}
        {!loading && result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Verification Banner */}
            <div className={`rounded-2xl p-6 text-center border ${
              verified
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  verified ? 'bg-green-500/20' : 'bg-red-500/20'
                }`}>
                  {verified
                    ? <CheckCircle2 className="w-8 h-8 text-green-400" />
                    : <AlertTriangle className="w-8 h-8 text-red-400" />
                  }
                </div>
                <div className="text-left">
                  <h2 className={`text-xl font-bold ${
                    verified ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {verified ? 'Offer Letter Verified' : 'Tamper Warning'}
                  </h2>
                  <p className={`text-sm ${
                    verified ? 'text-green-300/70' : 'text-red-300/70'
                  }`}>
                    {result.message}
                  </p>
                </div>
              </div>
              {verified && (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                  <Shield className="w-4 h-4" />
                  <span>Blockchain-verified digital signature</span>
                </div>
              )}
            </div>

            {/* Offer Details Card */}
            <Card className="bg-gray-800/50 border-gray-700 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-teal-600/20 to-orange-600/20 border-b border-gray-700">
                <CardTitle className="flex items-center gap-3 text-white">
                  <FileText className="w-6 h-6 text-teal-400" />
                  Internship Offer Letter
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Offer Number & Status */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Offer Number</p>
                    <p className="font-mono text-lg text-white">{result.offer_number}</p>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Status</p>
                    <div className="mt-1">{getStatusBadge(result.status)}</div>
                  </div>
                </div>

                {/* Candidate Info */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-teal-600/20 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-teal-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Candidate</p>
                      <p className="text-xl font-semibold text-white">{result.candidate_name}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-orange-600/20 rounded-full flex items-center justify-center">
                      <Briefcase className="w-6 h-6 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Program Track</p>
                      <p className="text-xl font-semibold text-white">{result.track_name || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Dates */}
                <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-gray-700">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-400">Date Issued</p>
                      <p className="text-white">
                        {result.issued_date
                          ? new Date(result.issued_date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Hash className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-400">Verification Method</p>
                      <p className="text-white flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-teal-400" />
                        SHA-256 Tamper-Proof Hash
                      </p>
                    </div>
                  </div>
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
              <Button asChild className="bg-gradient-to-r from-teal-600 to-orange-600 hover:from-teal-700 hover:to-orange-700">
                <Link href="/">
                  <GraduationCap className="w-4 h-4 mr-2" />
                  Explore Programs
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-gray-600 text-gray-300">
                <a
                  href={`https://study.afritechbridge.online`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Visit Website
                </a>
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
            <Link href="https://study.afritechbridge.online" className="text-teal-400 hover:underline">
              study.afritechbridge.online
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
