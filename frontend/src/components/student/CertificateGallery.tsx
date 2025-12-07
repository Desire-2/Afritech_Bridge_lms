"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Award, 
  Download, 
  Share2, 
  Eye, 
  ExternalLink,
  Star,
  Calendar,
  User,
  GraduationCap,
  Trophy,
  Verified,
  Copy,
  Mail,
  Facebook,
  Twitter,
  Linkedin,
  Link2,
  Check,
  Medal,
  Crown,
  Zap,
  BookOpen,
  Code,
  Palette,
  Database,
  Globe,
  Shield,
  FileText,
  Target,
  Lock,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { StudentApiService, Certificate, SkillBadge } from '@/services/studentApi';
import Link from 'next/link';
import Image from 'next/image';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Suppress jsPDF filesystem warnings globally (benign browser compatibility messages)
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    // Filter out jsPDF filesystem warnings
    if (typeof args[0] === 'string' && (
      args[0].includes('filesystem') || 
      args[0].includes('illegal path')
    )) {
      return; // Suppress these specific warnings
    }
    originalConsoleError.apply(console, args);
  };
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5
    }
  }
};

interface CertificateCardProps {
  certificate: Certificate & {
    completion_percentage?: number;
    is_locked?: boolean;
    completion_status?: string;
  };
  onView: (certificate: Certificate) => void;
  onShare: (certificate: Certificate) => void;
}

const CertificateCard: React.FC<CertificateCardProps> = ({ certificate, onView, onShare }) => {
  // Helper to get status badge color
  const getStatusColor = () => {
    if (certificate.completion_status === 'completed') {
      return 'bg-green-100 text-green-800 border-green-200';
    } else if (certificate.completion_status === 'in_progress') {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    } else {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getStatusLabel = () => {
    if (certificate.completion_status === 'completed') {
      return 'Completed';
    } else if (certificate.completion_status === 'in_progress') {
      return 'In Progress';
    } else {
      return 'Not Started';
    }
  };

  const isLocked = certificate.is_locked !== false;
  const completionPercentage = certificate.completion_percentage || 0;

  return (
    <motion.div variants={itemVariants}>
      <Card className={`group hover:shadow-2xl transition-all duration-500 hover:scale-105 relative overflow-hidden ${
        isLocked ? 'opacity-85' : ''
      }`}>
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 opacity-50" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-yellow-200/20 to-transparent rounded-full -translate-y-16 translate-x-16" />
        
        {/* Lock Overlay for Locked Certificates */}
        {isLocked && (
          <div className="absolute inset-0 bg-black/5 z-10 rounded-lg" />
        )}
        
        <CardContent className="p-6 relative">
          <div className="space-y-4">
            {/* Header with Icon */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-3 rounded-full ${
                  isLocked 
                    ? 'bg-gradient-to-br from-gray-400 to-gray-600' 
                    : 'bg-gradient-to-br from-yellow-400 to-orange-500'
                }`}>
                  {isLocked ? (
                    <Lock className="h-6 w-6 text-white" />
                  ) : (
                    <GraduationCap className="h-6 w-6 text-white" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{certificate.course_title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {isLocked ? 'Locked Certificate' : 'Course Certificate'}
                  </p>
                </div>
              </div>
              <Badge className={`${getStatusColor()} border`}>
                {isLocked ? (
                  <>
                    <Lock className="h-3 w-3 mr-1" />
                    {getStatusLabel()}
                  </>
                ) : (
                  <>
                    <Verified className="h-3 w-3 mr-1" />
                    Verified
                  </>
                )}
              </Badge>
            </div>

            {/* Certificate Details */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center text-muted-foreground">
                  <User className="h-4 w-4 mr-2" />
                  {certificate.student_name}
                </div>
                <div className="flex items-center text-muted-foreground">
                  <Calendar className="h-4 w-4 mr-2" />
                  {new Date(certificate.issued_at || certificate.issued_date || new Date()).toLocaleDateString()}
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Certificate ID: {certificate.certificate_number}
              </div>

              {/* Progress Bar for Locked Certificates */}
              {isLocked && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-muted-foreground">Progress</span>
                    <span className="text-xs font-bold text-blue-600">{completionPercentage}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300"
                      style={{ width: `${Math.min(completionPercentage, 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Skills */}
              <div className="flex flex-wrap gap-1">
                {(certificate.skills_acquired || certificate.skills_demonstrated || []).slice(0, 3).map((skill: string, index: number) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {skill}
                  </Badge>
                ))}
                {(certificate.skills_acquired || certificate.skills_demonstrated || []).length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{(certificate.skills_acquired || certificate.skills_demonstrated || []).length - 3} more
                  </Badge>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-2 pt-2">
              <Button 
                size="sm" 
                onClick={() => onView(certificate)} 
                className="flex-1"
                variant={isLocked ? "outline" : "default"}
              >
                <Eye className="h-4 w-4 mr-2" />
                {isLocked ? 'Preview' : 'View'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => onShare(certificate)}>
                <Share2 className="h-4 w-4" />
              </Button>
              {!isLocked && (
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Lock Status Message */}
            {isLocked && (
              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                🔒 Complete the course to unlock your certificate
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

interface BadgeCardProps {
  badge: SkillBadge;
  isEarned: boolean;
}

const BadgeCard: React.FC<BadgeCardProps> = ({ badge, isEarned }) => {
  const getBadgeIcon = (name: string) => {
    const iconMap: { [key: string]: React.ReactNode } = {
      'Python Basics': <Code className="h-6 w-6" />,
      'Web Development': <Globe className="h-6 w-6" />,
      'Database Design': <Database className="h-6 w-6" />,
      'API Development': <Zap className="h-6 w-6" />,
      'Data Analysis': <BookOpen className="h-6 w-6" />,
      'UI/UX Design': <Palette className="h-6 w-6" />,
      'Security': <Shield className="h-6 w-6" />
    };
    return iconMap[name] || <Medal className="h-6 w-6" />;
  };

  const getBadgeColor = (name: string) => {
    const colorMap: { [key: string]: string } = {
      'Python Basics': 'from-blue-400 to-blue-600',
      'Web Development': 'from-green-400 to-green-600',
      'Database Design': 'from-purple-400 to-purple-600',
      'API Development': 'from-yellow-400 to-orange-500',
      'Data Analysis': 'from-red-400 to-pink-500',
      'UI/UX Design': 'from-pink-400 to-rose-500',
      'Security': 'from-gray-400 to-gray-600'
    };
    return colorMap[name] || 'from-indigo-400 to-indigo-600';
  };

  return (
    <motion.div variants={itemVariants}>
      <Card className={`group hover:shadow-lg transition-all duration-300 hover:scale-105 ${
        !isEarned ? 'opacity-50 grayscale' : ''
      }`}>
        <CardContent className="p-6 text-center space-y-4">
          <div className="relative">
            <div className={`mx-auto w-16 h-16 rounded-full bg-gradient-to-br ${getBadgeColor(badge.name)} 
              flex items-center justify-center text-white shadow-lg ${
              isEarned ? 'animate-pulse' : ''
            }`}>
              {getBadgeIcon(badge.name)}
            </div>
            {isEarned && (
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <Check className="h-3 w-3 text-white" />
              </div>
            )}
          </div>
          
          <div>
            <h3 className="font-semibold text-lg">{badge.name}</h3>
            <p className="text-sm text-muted-foreground">{badge.description}</p>
          </div>
          
          {isEarned ? (
            <div className="space-y-2">
              <Badge className="bg-green-100 text-green-800 border-green-200">
                <Star className="h-3 w-3 mr-1" />
                Earned
              </Badge>
              {badge.earned_date && (
                <p className="text-xs text-muted-foreground">
                  {new Date(badge.earned_date).toLocaleDateString()}
                </p>
              )}
            </div>
          ) : (
            <Badge variant="outline">Not Earned</Badge>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

interface CertificateViewerProps {
  certificate: Certificate;
  isOpen: boolean;
  onClose: () => void;
}

const CertificateViewer: React.FC<CertificateViewerProps> = ({ certificate, isOpen, onClose }) => {
  const certificateRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const verificationUrl = certificate.verification_url || 
    `https://study.afritechbridge.online/verify/${certificate.certificate_number}`;

  const handleDownloadImage = async () => {
    if (!certificateRef.current) return;
    
    setIsDownloading(true);
    try {
      // Wait for all images to fully load
      const images = certificateRef.current.querySelectorAll('img');
      await Promise.all(
        Array.from(images).map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        })
      );
      
      // Small delay to ensure rendering is complete
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Capture the certificate element as canvas
      const canvas = await html2canvas(certificateRef.current, {
        scale: 4, // Very high quality
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
        imageTimeout: 30000,
        removeContainer: false,
        foreignObjectRendering: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: certificateRef.current.scrollWidth,
        windowHeight: certificateRef.current.scrollHeight,
      });
      
      // Convert canvas to blob and download as PNG
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${certificate.course_title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_Certificate.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      }, 'image/png', 1.0);
      
    } catch (error) {
      console.error('Error generating image:', error);
      alert('Failed to generate image. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownload = async () => {
    if (!certificateRef.current) return;
    
    setIsDownloading(true);
    try {
      // Wait for all images to fully load
      const images = certificateRef.current.querySelectorAll('img');
      await Promise.all(
        Array.from(images).map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        })
      );
      
      // Small delay to ensure rendering is complete
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Capture the certificate element as canvas - exact appearance
      const canvas = await html2canvas(certificateRef.current, {
        scale: 4, // Very high quality for print
        useCORS: true,
        allowTaint: true,
        backgroundColor: null, // Keep transparency/original background
        logging: false,
        imageTimeout: 30000,
        removeContainer: false,
        foreignObjectRendering: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: certificateRef.current.scrollWidth,
        windowHeight: certificateRef.current.scrollHeight,
      });
      
      // Create PDF in landscape orientation - A4 size
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Calculate dimensions to fit the page perfectly
      const canvasRatio = canvas.width / canvas.height;
      const pageRatio = pageWidth / pageHeight;
      
      let imgWidth, imgHeight, xOffset, yOffset;
      
      if (canvasRatio > pageRatio) {
        // Canvas is wider - fit to width
        imgWidth = pageWidth;
        imgHeight = pageWidth / canvasRatio;
        xOffset = 0;
        yOffset = (pageHeight - imgHeight) / 2;
      } else {
        // Canvas is taller - fit to height
        imgHeight = pageHeight;
        imgWidth = pageHeight * canvasRatio;
        xOffset = (pageWidth - imgWidth) / 2;
        yOffset = 0;
      }
      
      const imgData = canvas.toDataURL('image/png', 1.0);
      pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgWidth, imgHeight);
      
      // Download the PDF
      const fileName = `${certificate.course_title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_Certificate.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleVerifyOnline = () => {
    window.open(verificationUrl, '_blank');
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-400" />
            Certificate of Completion
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            View, download, verify or share your certificate for {certificate.course_title}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Certificate Preview - A4 Landscape Ratio */}
          <div 
            ref={certificateRef}
            className="relative overflow-hidden rounded-lg shadow-2xl border-4 border-yellow-500/30"
            style={{ aspectRatio: '1.414/1', minHeight: '500px' }}
          >
            {/* Solid Background for better PDF export */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-blue-900 to-slate-900" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-purple-600/20 via-transparent to-transparent" />
            
            {/* Decorative Pattern Overlay */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }} />
            </div>
            
            {/* Golden Border Frame */}
            <div className="absolute inset-2 border-2 border-yellow-500/50 rounded-lg" />
            <div className="absolute inset-3 border border-yellow-400/30 rounded-lg" />
            
            {/* Corner Decorations - Minimalist */}
            <div className="absolute top-3 left-3">
              <div className="w-8 h-8 border-l-2 border-t-2 border-yellow-400 rounded-tl-lg" />
            </div>
            <div className="absolute top-3 right-3">
              <div className="w-8 h-8 border-r-2 border-t-2 border-yellow-400 rounded-tr-lg" />
            </div>
            <div className="absolute bottom-3 left-3">
              <div className="w-8 h-8 border-l-2 border-b-2 border-yellow-400 rounded-bl-lg" />
            </div>
            <div className="absolute bottom-3 right-3">
              <div className="w-8 h-8 border-r-2 border-b-2 border-yellow-400 rounded-br-lg" />
            </div>
            
            {/* Main Content - Optimized Spacing */}
            <div className="relative z-10 h-full flex flex-col px-8 py-5">
              {/* Header Section - Streamlined */}
              <div className="flex items-center justify-between mb-3">
                {/* Logo */}
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-0 bg-yellow-400/20 blur-md rounded-full" />
                  <div className="relative p-0.5 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src="/logo.jpg" 
                      alt="Afritec Bridge Logo" 
                      width={50} 
                      height={50}
                      className="rounded-full block"
                      crossOrigin="anonymous"
                    />
                  </div>
                </div>
                
                {/* Title */}
                <div className="text-center flex-1">
                  <p className="text-yellow-400 text-xs font-medium tracking-[0.25em] uppercase mb-0.5">Afritec Bridge Academy</p>
                  <h1 className="text-2xl font-bold text-yellow-400">
                    Certificate of Completion
                  </h1>
                </div>
                
                {/* Trophy Icon */}
                <div className="flex-shrink-0">
                  <Trophy className="w-12 h-12 text-yellow-400" />
                </div>
              </div>
              
              {/* Divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-yellow-400/40 to-transparent mb-3" />
              
              {/* Middle Section - Compact & Organized */}
              <div className="flex-1 flex flex-col justify-center text-center space-y-2">
                <p className="text-blue-200 text-sm">This is to certify that</p>
                
                {/* Student Name */}
                <div className="relative py-1.5">
                  <h2 className="text-2xl font-bold text-white tracking-wide">
                    {certificate.student_name}
                  </h2>
                  <div className="mx-auto mt-1 w-48 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
                </div>
                
                <p className="text-blue-200 text-sm">has successfully completed the course</p>
                
                {/* Course Title */}
                <div className="inline-block mx-auto bg-white/10 backdrop-blur-sm rounded-lg px-4 py-1.5 border border-white/20 max-w-3xl">
                  <h3 className="text-base font-semibold text-yellow-300 line-clamp-2">
                    {certificate.course_title}
                  </h3>
                </div>
                
                {/* Skills Section - Optimized */}
                <div className="space-y-1.5 py-2">
                  <p className="text-blue-200 text-[11px] font-medium">Demonstrating proficiency in:</p>
                  <div className="grid grid-cols-3 gap-2 max-w-3xl mx-auto px-2">
                    {(certificate.skills_acquired || certificate.skills_demonstrated || []).slice(0, 6).map((skill: string, index: number) => (
                      <div 
                        key={index} 
                        className="px-2 py-1.5 bg-gradient-to-r from-blue-600/40 to-purple-600/40 rounded-md border border-white/20"
                        style={{ 
                          minHeight: '2.2rem', 
                          maxHeight: '3rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden'
                        }}
                        title={skill}
                      >
                        <span 
                          className="text-[9px] text-white text-center w-full"
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            wordBreak: 'break-word',
                            lineHeight: '1.2',
                            padding: '0 2px'
                          }}
                        >
                          {skill}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Grade Badge */}
                {certificate.grade && (
                  <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-yellow-500 to-orange-500 px-3 py-1 rounded-full mx-auto mt-1">
                    <Medal className="w-3.5 h-3.5 text-white" />
                    <span className="text-white font-bold text-sm">Grade: {certificate.grade}</span>
                    {certificate.overall_score && (
                      <span className="text-white/80 text-xs">({certificate.overall_score.toFixed(1)}%)</span>
                    )}
                  </div>
                )}
              </div>
              
              {/* Divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-yellow-400/40 to-transparent mt-3 mb-2" />
              
              {/* Footer Section - Compact & Professional */}
              <div className="grid grid-cols-3 gap-4 items-center">
                {/* Left Column - Date & Certificate ID */}
                <div className="text-left space-y-1">
                  <div>
                    <p className="text-blue-300 text-[9px] uppercase tracking-wide mb-0.5">Date Issued</p>
                    <p className="text-white font-semibold text-xs">
                      {new Date(certificate.issued_at || certificate.issued_date || new Date()).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-blue-300 text-[9px] uppercase tracking-wide mb-0.5">Certificate ID</p>
                    <p className="text-white font-mono text-[10px]">{certificate.certificate_number}</p>
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <Verified className="w-2.5 h-2.5 text-green-400" />
                      <span className="text-green-400 text-[9px]">Verified</span>
                    </div>
                  </div>
                </div>
                
                {/* Center Column - Signature */}
                <div className="text-center flex flex-col items-center justify-end">
                  <div className="inline-block mb-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src="/sign.jpg" 
                      alt="CEO Signature" 
                      width={100} 
                      height={40}
                      className="object-contain"
                      crossOrigin="anonymous"
                    />
                  </div>
                  <div className="border-t border-yellow-400/50 pt-0.5 w-28">
                    <p className="font-semibold text-white text-[11px]">Desire Bikorimana</p>
                    <p className="text-yellow-400 text-[9px]">Founder & CEO</p>
                  </div>
                </div>
                
                {/* Right Column - QR Code */}
                <div className="text-right flex flex-col items-end justify-end">
                  <div className="inline-block">
                    <div className="bg-gray-800/30 backdrop-blur-sm rounded-md p-1.5 border border-yellow-400/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(certificate.verification_url || `https://study.afritechbridge.online/verify/${certificate.certificate_number}`)}`}
                        alt="QR Code"
                        width={60}
                        height={60}
                        className="rounded block"
                        crossOrigin="anonymous"
                      />
                    </div>
                    <p className="text-blue-300 text-[8px] mt-0.5">Scan to Verify</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex justify-center gap-3">
            <Button 
              onClick={handleDownload} 
              disabled={isDownloading}
              className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </>
              )}
            </Button>
            <Button 
              onClick={handleDownloadImage} 
              disabled={isDownloading}
              variant="outline"
              className="border-yellow-500 text-yellow-400 hover:bg-yellow-500/10"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download Image
                </>
              )}
            </Button>
            <Button 
              onClick={handleVerifyOnline}
              variant="outline" 
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Verify Online
            </Button>
            <Button 
              onClick={() => setShareDialogOpen(true)}
              variant="outline" 
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
          
          {/* Verification Info */}
          <div className="bg-gray-800/50 p-4 rounded-lg text-center border border-gray-700">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-green-400" />
              <span className="text-green-400 text-sm font-medium">Blockchain Verified Certificate</span>
            </div>
            <p className="text-sm text-gray-400">
              Verification Hash: <span className="font-mono text-gray-300">{certificate.verification_hash || certificate.certificate_number}</span>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    
    {/* Share Dialog */}
    <ShareDialog 
      certificate={{...certificate, verification_url: verificationUrl}} 
      isOpen={shareDialogOpen} 
      onClose={() => setShareDialogOpen(false)} 
    />
    </>
  );
};

interface ShareDialogProps {
  certificate: Certificate;
  isOpen: boolean;
  onClose: () => void;
}

const ShareDialog: React.FC<ShareDialogProps> = ({ certificate, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const shareUrl = certificate.verification_url || 
    `https://study.afritechbridge.online/verify/${certificate.certificate_number}`;
  
  const shareMessage = `🎓 I just earned a certificate in "${certificate.course_title}" from Afritec Bridge Academy! Check it out:`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const shareLinks = [
    {
      name: 'LinkedIn',
      icon: <Linkedin className="h-5 w-5" />,
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      color: 'bg-blue-600 hover:bg-blue-700'
    },
    {
      name: 'Twitter',
      icon: <Twitter className="h-5 w-5" />,
      url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareMessage)}`,
      color: 'bg-sky-500 hover:bg-sky-600'
    },
    {
      name: 'Facebook',
      icon: <Facebook className="h-5 w-5" />,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareMessage)}`,
      color: 'bg-blue-800 hover:bg-blue-900'
    },
    {
      name: 'Email',
      icon: <Mail className="h-5 w-5" />,
      url: `mailto:?subject=${encodeURIComponent(`Certificate: ${certificate.course_title} - Afritec Bridge`)}&body=${encodeURIComponent(`${shareMessage}\n\n${shareUrl}`)}`,
      color: 'bg-gray-600 hover:bg-gray-700'
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Certificate</DialogTitle>
          <DialogDescription>
            Share your certificate on social media or copy the verification link
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Share Link */}
          <div>
            <label className="text-sm font-medium">Certificate Link</label>
            <div className="flex mt-2">
              <Input value={shareUrl} readOnly className="flex-1" />
              <Button onClick={handleCopyLink} className="ml-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            {copied && (
              <p className="text-sm text-green-600 mt-1">Link copied to clipboard!</p>
            )}
          </div>
          
          {/* Social Share Buttons */}
          <div>
            <label className="text-sm font-medium mb-3 block">Share on social media</label>
            <div className="grid grid-cols-2 gap-3">
              {shareLinks.map((platform) => (
                <a
                  key={platform.name}
                  href={platform.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${platform.color} text-white p-3 rounded-lg flex items-center justify-center space-x-2 transition-colors`}
                >
                  {platform.icon}
                  <span className="font-medium">{platform.name}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const CertificateGallery: React.FC = () => {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [badges, setBadges] = useState<SkillBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);
  const [showCertificateViewer, setShowCertificateViewer] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [selectedTab, setSelectedTab] = useState('certificates');
  const [newCertificateAlert, setNewCertificateAlert] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      console.log('📥 Fetching certificates and badges...');
      const [certsData, badgesData] = await Promise.all([
        StudentApiService.getCertificates(),
        StudentApiService.getBadges()
      ]);
      
      console.log('📦 Certificates Data:', certsData);
      console.log('📦 Badges Data:', badgesData);
      
      // Check for new certificates
      const newCerts = Array.isArray(certsData) ? certsData : [];
      console.log(`✅ Setting ${newCerts.length} certificates to state`);
      
      if (newCerts.length > certificates.length && certificates.length > 0) {
        setNewCertificateAlert(true);
        setTimeout(() => setNewCertificateAlert(false), 5000);
      }
      
      setCertificates(newCerts);
      setBadges(Array.isArray(badgesData) ? badgesData : []);
    } catch (error) {
      console.error('❌ Failed to fetch certificate data:', error);
    } finally {
      setLoading(false);
    }
  }, [certificates.length]);

  useEffect(() => {
    fetchData();
    
    // Poll for new certificates every 30 seconds
    const interval = setInterval(fetchData, 30000);
    
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleViewCertificate = (certificate: Certificate) => {
    setSelectedCertificate(certificate);
    setShowCertificateViewer(true);
  };

  const handleShareCertificate = (certificate: Certificate) => {
    setSelectedCertificate(certificate);
    setShowShareDialog(true);
  };

  const earnedBadges = (badges || []).filter(badge => badge.earned_date);
  const availableBadges = (badges || []).filter(badge => !badge.earned_date);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <motion.div 
      className="space-y-8 p-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* New Certificate Alert */}
      <AnimatePresence>
        {newCertificateAlert && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 right-4 z-50 bg-green-500 text-white p-4 rounded-lg shadow-lg max-w-sm"
          >
            <div className="flex items-center space-x-3">
              <Trophy className="h-6 w-6" />
              <div>
                <h4 className="font-semibold">New Certificate Earned! 🎉</h4>
                <p className="text-sm">Congratulations on completing your course!</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Your Achievement Gallery
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Showcase your learning achievements and earned credentials
          </p>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="text-center">
            <CardContent className="p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="p-3 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full">
                  <Award className="h-8 w-8 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold">{certificates.length}</h3>
              <p className="text-muted-foreground">Certificates Earned</p>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardContent className="p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="p-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full">
                  <Trophy className="h-8 w-8 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold">{earnedBadges.length}</h3>
              <p className="text-muted-foreground">Skills Badges</p>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardContent className="p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="p-3 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full">
                  <Crown className="h-8 w-8 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold">
                {Math.round((earnedBadges.length / badges.length) * 100)}%
              </h3>
              <p className="text-muted-foreground">Completion Rate</p>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Main Content */}
      <motion.div variants={itemVariants}>
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="certificates">Certificates</TabsTrigger>
            <TabsTrigger value="badges">Skill Badges</TabsTrigger>
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
          </TabsList>

          <TabsContent value="certificates" className="mt-8">
            {certificates.length > 0 ? (
              <motion.div 
                variants={containerVariants}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {certificates.map((certificate) => (
                  <CertificateCard
                    key={certificate.id}
                    certificate={certificate}
                    onView={handleViewCertificate}
                    onShare={handleShareCertificate}
                  />
                ))}
              </motion.div>
            ) : (
              <div className="text-center py-12">
                <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No certificates yet</h3>
                <p className="text-muted-foreground mb-4">
                  Complete courses to earn your first certificate
                </p>
                <Link href="/student/courses">
                  <Button>Browse Courses</Button>
                </Link>
              </div>
            )}
          </TabsContent>

          <TabsContent value="badges" className="mt-8">
            <div className="space-y-8">
              {/* Earned Badges */}
              {earnedBadges.length > 0 && (
                <div>
                  <h3 className="text-2xl font-bold mb-6 flex items-center">
                    <Trophy className="h-6 w-6 mr-2 text-yellow-500" />
                    Earned Badges ({earnedBadges.length})
                  </h3>
                  <motion.div 
                    variants={containerVariants}
                    className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6"
                  >
                    {earnedBadges.map((badge) => (
                      <BadgeCard key={badge.id} badge={badge} isEarned={true} />
                    ))}
                  </motion.div>
                </div>
              )}

              {/* Available Badges */}
              {availableBadges.length > 0 && (
                <div>
                  <h3 className="text-2xl font-bold mb-6 flex items-center">
                    <Target className="h-6 w-6 mr-2 text-muted-foreground" />
                    Available Badges ({availableBadges.length})
                  </h3>
                  <motion.div 
                    variants={containerVariants}
                    className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6"
                  >
                    {availableBadges.map((badge) => (
                      <BadgeCard key={badge.id} badge={badge} isEarned={false} />
                    ))}
                  </motion.div>
                </div>
              )}

              {badges.length === 0 && (
                <div className="text-center py-12">
                  <Medal className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No badges available</h3>
                  <p className="text-muted-foreground">Check back later for new skill badges</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="transcript" className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BookOpen className="h-5 w-5 mr-2" />
                  Academic Transcript
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Transcript Generation</h3>
                  <p className="text-muted-foreground mb-4">
                    Generate a comprehensive transcript of all your completed courses and achievements
                  </p>
                  <Button>Generate Transcript</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Dialogs */}
      {selectedCertificate && (
        <>
          <CertificateViewer
            certificate={selectedCertificate}
            isOpen={showCertificateViewer}
            onClose={() => {
              setShowCertificateViewer(false);
              setSelectedCertificate(null);
            }}
          />
          <ShareDialog
            certificate={selectedCertificate}
            isOpen={showShareDialog}
            onClose={() => {
              setShowShareDialog(false);
              setSelectedCertificate(null);
            }}
          />
        </>
      )}
    </motion.div>
  );
};

export default CertificateGallery;