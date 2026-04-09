'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AdminStudentService, StudentDetailResponse } from '@/services/admin-student.service';
import { toast } from 'sonner';
import {
  ArrowLeft, RefreshCw, Mail, BookPlus, CheckCircle2, AlertCircle, Clock,
  AlertTriangle, Zap, TrendingUp, Award, BookOpen, Target, Eye, EyeOff,
  Download, Copy, Shield, Save, X, FileText
} from 'lucide-react';

interface CertificateEligibility {
  course_id: number;
  course_title: string;
  enrollment_id: number;
  enrollment_status: string;
  enrollment_progress: number;
  enrollment_course_score?: number;
  eligible: boolean;
  reason: string;
  requirements: {
    completed_modules?: number;
    total_modules?: number;
    overall_score?: number;
    passing_score?: number;
    module_details?: Array<{
      module_id?: number;
      module: string;
      status: string;
      score: number;
      attempts: number;
    }>;
    [key: string]: any;
  };
  certificate_exists: boolean;
  certificate_id: number | null;
  certificate_issued_at: string | null;
}

export default function StudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const studentId = parseInt(params.id as string);

  const [detail, setDetail] = useState<StudentDetailResponse | null>(null);
  const [certificates, setCertificates] = useState<CertificateEligibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [certLoading, setCertLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'certificates' | 'details'>('overview');
  const [selectedCourse, setSelectedCourse] = useState<CertificateEligibility | null>(null);
  const [validatingCert, setValidatingCert] = useState<number | null>(null);
  const [validationReason, setValidationReason] = useState('');
  const [forceOverride, setForceOverride] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [pendingCertValidation, setPendingCertValidation] = useState<{ studentId: number; courseId: number } | null>(null);
  
  // Module grading state
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [gradeScore, setGradeScore] = useState(0);
  const [gradeReason, setGradeReason] = useState('');
  const [gradingModuleId, setGradingModuleId] = useState<number | null>(null);
  const [gradingModuleTitle, setGradingModuleTitle] = useState('');
  const [moduleAssessments, setModuleAssessments] = useState<any>(null);
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [isGrading, setIsGrading] = useState(false);

  // ─── Fetch Student Detail ─────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await AdminStudentService.getStudentDetail(studentId);
        setDetail(response);
      } catch (e: any) {
        toast.error(e.message || 'Failed to load student details');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [studentId]);

  // ─── Fetch Certificate Eligibility ────────────────────────────────────
  useEffect(() => {
    const fetchCertificates = async () => {
      try {
        setCertLoading(true);
        const response = await AdminStudentService.getStudentCertificatesEligibility(studentId);
        setCertificates(response.certificates);
        if (response.certificates.length > 0) {
          setSelectedCourse(response.certificates[0]);
        }
      } catch (e: any) {
        toast.error(e.message || 'Failed to load certificate data');
      } finally {
        setCertLoading(false);
      }
    };
    fetchCertificates();
  }, [studentId]);

  // ─── Validate Certificate ─────────────────────────────────────────────
  const handleValidateCertificate = async () => {
    if (!pendingCertValidation) return;

    try {
      setValidatingCert(pendingCertValidation.courseId);
      const response = await AdminStudentService.validateCertificateAdmin(
        pendingCertValidation.studentId,
        pendingCertValidation.courseId,
        {
          reason: validationReason || 'Certificate validated by admin',
          force_override: forceOverride,
        }
      );

      toast.success(response.message);
      setShowValidationModal(false);
      setValidationReason('');
      setForceOverride(false);
      setPendingCertValidation(null);

      // Refresh certificates
      const updated = await AdminStudentService.getStudentCertificatesEligibility(studentId);
      setCertificates(updated.certificates);
    } catch (e: any) {
      toast.error(e.message || 'Failed to validate certificate');
    } finally {
      setValidatingCert(null);
    }
  };

  // ─── Grade Module Handlers ────────────────────────────────────────────
  const handleOpenGradeModal = async (moduleId: number, moduleTitle: string) => {
    try {
      setLoadingAssessments(true);
      setGradingModuleId(moduleId);
      setGradingModuleTitle(moduleTitle);
      const assessments = await AdminStudentService.getModuleAssessments(studentId, moduleId);
      setModuleAssessments(assessments);
      setShowGradeModal(true);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load module assessments');
    } finally {
      setLoadingAssessments(false);
    }
  };

  const handleGradeModule = async () => {
    if (gradingModuleId === null || gradeScore < 0 || gradeScore > 100) {
      toast.error('Invalid score. Must be between 0 and 100.');
      return;
    }

    try {
      setIsGrading(true);
      const response = await AdminStudentService.gradeModuleManual(
        studentId,
        gradingModuleId,
        {
          score: gradeScore,
          reason: gradeReason || 'Manually graded by admin',
        }
      );

      toast.success(response.message);
      setShowGradeModal(false);
      setGradeScore(0);
      setGradeReason('');
      setGradingModuleId(null);
      setGradingModuleTitle('');
      setModuleAssessments(null);

      // Refresh certificates
      const updated = await AdminStudentService.getStudentCertificatesEligibility(studentId);
      setCertificates(updated.certificates);
    } catch (e: any) {
      toast.error(e.message || 'Failed to grade module');
    } finally {
      setIsGrading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-[#0d1b2a] animate-spin" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen bg-[#0a0e27] p-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4 text-red-200">
          Student not found
        </div>
      </div>
    );
  }

  const name = detail.student.first_name && detail.student.last_name
    ? `${detail.student.first_name} ${detail.student.last_name}`
    : detail.student.username;

  const elegibleCount = certificates.filter(c => c.eligible).length;
  const ineligibleCount = certificates.filter(c => !c.eligible).length;
  const certCount = certificates.filter(c => c.certificate_exists).length;

  return (
    <div className="min-h-screen bg-[#0a0e27]">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-[#0a0e27]/95 backdrop-blur border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">{name}</h1>
              <p className="text-sm text-gray-400">{detail.student.email}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Student ID: {studentId}</p>
            <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${
              detail.student.is_active
                ? 'bg-emerald-900/40 text-emerald-300'
                : 'bg-red-900/40 text-red-300'
            }`}>
              {detail.student.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Main Content ───────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#0d1b2a] rounded-lg p-4 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Enrolled Courses</p>
                <p className="text-2xl font-bold text-white">{certificates.length}</p>
              </div>
              <BookOpen className="w-8 h-8 text-blue-400/40" />
            </div>
          </div>
          <div className="bg-[#0d1b2a] rounded-lg p-4 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Eligible for Cert</p>
                <p className="text-2xl font-bold text-emerald-300">{elegibleCount}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-400/40" />
            </div>
          </div>
          <div className="bg-[#0d1b2a] rounded-lg p-4 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Not Eligible</p>
                <p className="text-2xl font-bold text-amber-300">{ineligibleCount}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-amber-400/40" />
            </div>
          </div>
          <div className="bg-[#0d1b2a] rounded-lg p-4 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Certificates Issued</p>
                <p className="text-2xl font-bold text-purple-300">{certCount}</p>
              </div>
              <Award className="w-8 h-8 text-purple-400/40" />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-white/10">
          {[
            { id: 'overview' as const, label: 'Overview', icon: FileText },
            { id: 'certificates' as const, label: 'Certificate Analysis', icon: Award },
            { id: 'details' as const, label: 'Enrollments & Quiz', icon: BookOpen },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                selectedTab === tab.id
                  ? 'border-white text-white'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── Overview Tab ────────────────────────────────────────────── */}
        {selectedTab === 'overview' && (
          <div className="space-y-6">
            {/* Student Info */}
            <div className="bg-[#0d1b2a] rounded-lg border border-white/10 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Student Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-500 font-medium mb-1">Full Name</p>
                  <p className="text-white">{name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium mb-1">Email</p>
                  <p className="text-white break-all">{detail.student.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium mb-1">Phone</p>
                  <p className="text-white">{detail.student.phone_number || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium mb-1">WhatsApp</p>
                  <p className="text-white">{detail.student.whatsapp_number || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium mb-1">Joined</p>
                  <p className="text-white">{new Date(detail.student.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium mb-1">Last Login</p>
                  <p className="text-white">
                    {detail.activity?.last_login
                      ? new Date(detail.activity.last_login).toLocaleDateString()
                      : 'Never'}
                  </p>
                </div>
              </div>
            </div>

            {/* Gamification Stats */}
            <div className="bg-[#0d1b2a] rounded-lg border border-white/10 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Gamification & Achievements</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/5 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Total Points</p>
                  <p className="text-2xl font-bold text-yellow-400">{detail.achievements?.student_points || 0}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Achievements</p>
                  <p className="text-2xl font-bold text-purple-400">{detail.achievements?.total_achievements || 0}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Learning Streak</p>
                  <p className="text-2xl font-bold text-blue-400">{detail.achievements?.current_streak || 0} days</p>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Milestones</p>
                  <p className="text-2xl font-bold text-indigo-400">{detail.achievements?.milestones || 0}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Certificate Analysis Tab ───────────────────────────────── */}
        {selectedTab === 'certificates' && (
          <div className="space-y-6">
            {certLoading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-6 h-6 text-[#0d1b2a] animate-spin" />
              </div>
            ) : certificates.length === 0 ? (
              <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-6 text-center">
                <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                <p className="text-amber-200">No course enrollments found</p>
              </div>
            ) : (
              <div>
                {/* Certificate Cards */}
                <div className="space-y-4 mb-8">
                  {certificates.map((cert) => (
                    <div
                      key={cert.course_id}
                      onClick={() => setSelectedCourse(cert)}
                      className={`bg-[#0d1b2a] rounded-lg border p-5 cursor-pointer transition-all ${
                        selectedCourse?.course_id === cert.course_id
                          ? 'border-[#0d1b2a] ring-2 ring-blue-400'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="text-lg font-semibold text-white">{cert.course_title}</h4>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {cert.certificate_exists && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-900/40 text-emerald-300">
                                <CheckCircle2 className="w-3 h-3" /> Certificate Issued
                              </span>
                            )}
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                              cert.eligible
                                ? 'bg-emerald-900/40 text-emerald-300'
                                : 'bg-amber-900/40 text-amber-300'
                            }`}>
                              {cert.eligible ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" /> Eligible
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="w-3 h-3" /> Not Eligible
                                </>
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-white">
                            {Math.round(cert.enrollment_progress * 100)}%
                          </p>
                          <p className="text-xs text-gray-500">Completion</p>
                        </div>
                      </div>

                      {/* Requirement Status */}
                      <div className="bg-white/5 rounded p-3 mt-3">
                        <p className="text-xs text-gray-400 mb-2 font-medium">Status:</p>
                        <p className="text-sm text-gray-200">{cert.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Detailed Course Analysis */}
                {selectedCourse && (
                  <div className="bg-[#0d1b2a] rounded-lg border border-white/10 p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-semibold text-white">
                        Requirement Breakdown: {selectedCourse.course_title}
                      </h3>
                      {!selectedCourse.eligible && !selectedCourse.certificate_exists && (
                        <button
                          onClick={() => {
                            setPendingCertValidation({
                              studentId,
                              courseId: selectedCourse.course_id,
                            });
                            setShowValidationModal(true);
                          }}
                          disabled={validatingCert === selectedCourse.course_id}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                        >
                          {validatingCert === selectedCourse.course_id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Shield className="w-4 h-4" />
                          )}
                          Award Certificate
                        </button>
                      )}
                      {selectedCourse.certificate_exists && (
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Certificate Issued</p>
                          <p className="text-sm text-emerald-300">
                            {new Date(selectedCourse.certificate_issued_at!).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>

                    {selectedCourse.eligible ? (
                      <div className="bg-emerald-900/20 rounded-lg p-4 border border-emerald-700/30 mb-6">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-emerald-300">Student is Eligible</p>
                            <p className="text-sm text-emerald-200/80 mt-1">{selectedCourse.reason}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-900/20 rounded-lg p-4 border border-amber-700/30 mb-6">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-amber-300">Student Not Eligible</p>
                            <p className="text-sm text-amber-200/80 mt-1">{selectedCourse.reason}</p>
                            {selectedCourse.requirements.error && (
                              <p className="text-xs text-amber-200/60 mt-2 font-mono">Debug: {selectedCourse.requirements.error}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Module Breakdown */}
                    {selectedCourse.requirements?.module_details && Array.isArray(selectedCourse.requirements.module_details) && selectedCourse.requirements.module_details.length > 0 ? (
                      <div>
                        <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          Module Completion Status
                        </h4>
                        <div className="space-y-3">
                          {selectedCourse.requirements.module_details.map((module, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                if (module.status !== 'completed' && module.module_id) {
                                  handleOpenGradeModal(module.module_id, module.module);
                                }
                              }}
                              className={`bg-white/5 rounded-lg p-4 border transition-all ${
                                module.status !== 'completed'
                                  ? 'border-purple-500/30 hover:border-purple-500/60 hover:bg-purple-900/10 cursor-pointer'
                                  : 'border-white/10 cursor-default'
                              }`}
                            >
                              {/* Top Row: Module Name and Action Area */}
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-white">{module.module || module.module_name || `Module ${idx + 1}`}</p>
                                </div>
                                
                                {/* Right Side: Status Icon and Grade Button for Non-Completed */}
                                <div className="flex items-center gap-3 flex-shrink-0">
                                  {module.status === 'completed' ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                  ) : module.status === 'failed' ? (
                                    <AlertTriangle className="w-5 h-5 text-red-400" />
                                  ) : (
                                    <Clock className="w-5 h-5 text-amber-400" />
                                  )}
                                  
                                  {module.status !== 'completed' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (module.module_id) {
                                          handleOpenGradeModal(module.module_id, module.module);
                                        } else {
                                          toast.error('Module ID not found. Please refresh and try again.');
                                        }
                                      }}
                                      disabled={isGrading}
                                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                                      title="Manually grade this module"
                                    >
                                      <Zap className="w-3 h-3" />
                                      Grade
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Bottom Row: Score and Status Badge */}
                              <div className="flex items-center gap-4">
                                <div className="text-xs">
                                  <span className="text-gray-500">Score:</span>
                                  <span className="text-white font-bold ml-1">{module.score || 0}%</span>
                                </div>
                                <div className="text-xs">
                                  <span className={`font-semibold px-2 py-1 rounded ${
                                    module.status === 'completed'
                                      ? 'bg-emerald-900/40 text-emerald-300'
                                      : module.status === 'failed'
                                      ? 'bg-red-900/40 text-red-300'
                                      : 'bg-amber-900/40 text-amber-300'
                                  }`}>
                                    {module.status?.charAt(0).toUpperCase() + (module.status?.slice(1) || 'unknown')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white/5 rounded-lg p-4">
                        <p className="text-sm text-gray-400">No module details available</p>
                      </div>
                    )}

                    {/* Overall Score */}
                    {selectedCourse.requirements?.overall_score !== undefined && selectedCourse.requirements?.overall_score !== null && (
                      <div className="mt-6 pt-6 border-t border-white/10">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-white/5 rounded-lg p-4">
                            <p className="text-xs text-gray-500 font-medium mb-1">Module-Based Score</p>
                            <p className="text-2xl font-bold text-white">
                              {(selectedCourse.requirements.overall_score).toFixed(1)}%
                            </p>
                            <p className="text-xs text-gray-600 mt-1">{selectedCourse.requirements.overall_score === 0 ? '(No module data)' : '(From modules)'}</p>
                          </div>
                          {selectedCourse.enrollment_course_score !== undefined && selectedCourse.enrollment_course_score > 0 && (
                            <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-700/30">
                              <p className="text-xs text-gray-500 font-medium mb-1">Enrollment Score</p>
                              <p className="text-2xl font-bold text-blue-300">
                                {(selectedCourse.enrollment_course_score).toFixed(1)}%
                              </p>
                              <p className="text-xs text-blue-400/80 mt-1">(Recorded on enrollment)</p>
                            </div>
                          )}
                          <div className="bg-white/5 rounded-lg p-4">
                            <p className="text-xs text-gray-500 font-medium mb-1">Required Score</p>
                            <p className="text-2xl font-bold text-white">
                              {selectedCourse.requirements.passing_score || 80}%
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── Details Tab ────────────────────────────────────────────── */}
        {selectedTab === 'details' && (
          <div className="space-y-6">
            {/* Enrollments */}
            {detail.enrollments && detail.enrollments.length > 0 && (
              <div className="bg-[#0d1b2a] rounded-lg border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Enrollments ({detail.enrollments.length})</h3>
                <div className="space-y-3">
                  {detail.enrollments.map((enrollment) => (
                    <div key={enrollment.id} className="bg-white/5 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-white">{enrollment.course_title}</h4>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          enrollment.status === 'completed'
                            ? 'bg-emerald-900/40 text-emerald-300'
                            : enrollment.status === 'active'
                            ? 'bg-blue-900/40 text-blue-300'
                            : 'bg-red-900/40 text-red-300'
                        }`}>
                          {enrollment.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400 mt-2">
                        <span>Progress: <span className="text-white font-semibold">{Math.round(enrollment.progress * 100)}%</span></span>
                        <span>Score: <span className="text-white font-semibold">{Math.round(enrollment.course_score)}%</span></span>
                        <span>Enrolled: {new Date(enrollment.enrollment_date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quiz Performance */}
            {detail.quiz_performance && detail.quiz_performance.length > 0 && (
              <div className="bg-[#0d1b2a] rounded-lg border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Quiz Performance ({detail.quiz_performance.length})</h3>
                <div className="space-y-3">
                  {detail.quiz_performance.map((quiz, idx) => (
                    <div key={idx} className="bg-white/5 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-white">{quiz.quiz_title}</h4>
                          <p className="text-sm text-gray-400 mt-1">{quiz.course_title}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-white">{Math.round(quiz.score)}%</p>
                          <p className="text-xs text-gray-500">Attempt {quiz.attempt_number}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Certificate Validation Modal ────────────────────────────── */}
      {showValidationModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#0d1b2a] rounded-xl shadow-2xl max-w-lg w-full border border-white/10">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">Award Certificate</h3>
              </div>
              <button
                onClick={() => {
                  setShowValidationModal(false);
                  setPendingCertValidation(null);
                  setValidationReason('');
                  setForceOverride(false);
                }}
                className="p-1 hover:bg-white/10 rounded-lg text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
                <p className="text-sm text-blue-200">
                  <strong>Course:</strong> {selectedCourse?.course_title}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Reason for Award (optional)
                </label>
                <textarea
                  value={validationReason}
                  onChange={(e) => setValidationReason(e.target.value)}
                  placeholder="E.g., Manual override due to valid coursework..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 text-sm resize-none"
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                <input
                  type="checkbox"
                  id="forceOverride"
                  checked={forceOverride}
                  onChange={(e) => setForceOverride(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-400"
                />
                <label htmlFor="forceOverride" className="text-sm text-gray-300 cursor-pointer">
                  Force award even if requirements not met
                </label>
              </div>

              {forceOverride && (
                <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3">
                  <p className="text-xs text-amber-200">
                    ⚠️ This will mark the course as completed and generate a certificate regardless of module completion or scores.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-6 border-t border-white/10">
              <button
                onClick={() => {
                  setShowValidationModal(false);
                  setPendingCertValidation(null);
                  setValidationReason('');
                  setForceOverride(false);
                }}
                className="flex-1 px-4 py-2 border border-white/15 text-white rounded-lg text-sm font-medium hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleValidateCertificate}
                disabled={validatingCert !== null}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {validatingCert ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    Award Certificate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Grade Module Modal ────────────────────────────────────────── */}
      {showGradeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#0d1b2a] rounded-xl shadow-2xl max-w-lg w-full border border-white/10">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-semibold text-white">Grade Module</h3>
              </div>
              <button
                onClick={() => {
                  setShowGradeModal(false);
                  setGradeScore(0);
                  setGradeReason('');
                  setGradingModuleId(null);
                  setModuleAssessments(null);
                }}
                className="p-1 hover:bg-white/10 rounded-lg text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="bg-purple-900/20 border border-purple-700/30 rounded-lg p-4">
                <p className="text-sm text-purple-200">
                  <strong>Module:</strong> {gradingModuleTitle}
                </p>
              </div>

              {loadingAssessments ? (
                <div className="flex justify-center py-6">
                  <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />
                </div>
              ) : moduleAssessments ? (
                <div className="bg-white/5 rounded-lg p-4 max-h-48 overflow-y-auto">
                  <p className="text-xs text-gray-500 font-medium mb-2">Assessments to be graded:</p>
                  <div className="space-y-1">
                    {moduleAssessments.assessments.quizzes.length > 0 && (
                      <>
                        <p className="text-xs font-semibold text-purple-300">Quizzes ({moduleAssessments.assessments.quizzes.length})</p>
                        {moduleAssessments.assessments.quizzes.map((q: any) => (
                          <p key={q.id} className="text-xs text-gray-400 ml-2">• {q.title}</p>
                        ))}
                      </>
                    )}
                    {moduleAssessments.assessments.assignments.length > 0 && (
                      <>
                        <p className="text-xs font-semibold text-blue-300 mt-2">Assignments ({moduleAssessments.assessments.assignments.length})</p>
                        {moduleAssessments.assessments.assignments.map((a: any) => (
                          <p key={a.id} className="text-xs text-gray-400 ml-2">• {a.title}</p>
                        ))}
                      </>
                    )}
                    {moduleAssessments.assessments.projects.length > 0 && (
                      <>
                        <p className="text-xs font-semibold text-cyan-300 mt-2">Projects ({moduleAssessments.assessments.projects.length})</p>
                        {moduleAssessments.assessments.projects.map((p: any) => (
                          <p key={p.id} className="text-xs text-gray-400 ml-2">• {p.title}</p>
                        ))}
                      </>
                    )}
                    <p className="text-xs font-semibold text-gray-300 mt-3">Total: {moduleAssessments.total_assessments} assessments</p>
                  </div>
                </div>
              ) : null}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Score (0-100) *
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={gradeScore}
                  onChange={(e) => setGradeScore(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 text-sm"
                  placeholder="Enter score between 0 and 100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Reason (optional)
                </label>
                <textarea
                  value={gradeReason}
                  onChange={(e) => setGradeReason(e.target.value)}
                  placeholder="E.g., Manual grading based on portfolio review..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 text-sm resize-none"
                  rows={3}
                />
              </div>

              <div className="bg-purple-900/20 border border-purple-700/30 rounded-lg p-3">
                <p className="text-xs text-purple-200">
                  ℹ️ This grade will be applied to all assessments (quizzes, assignments, projects) in this module.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-6 border-t border-white/10">
              <button
                onClick={() => {
                  setShowGradeModal(false);
                  setGradeScore(0);
                  setGradeReason('');
                  setGradingModuleId(null);
                  setModuleAssessments(null);
                }}
                className="flex-1 px-4 py-2 border border-white/15 text-white rounded-lg text-sm font-medium hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleGradeModule}
                disabled={isGrading || gradeScore < 0 || gradeScore > 100}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {isGrading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Grading...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Grade Module
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
