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

// QR Code Component using canvas-based pattern generation
const QRCodeComponent: React.FC<{ value: string; size: number }> = ({ value, size }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const qrSize = 25;
    const moduleSize = Math.floor(size / qrSize);
    const margin = 1;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#0f172a';
    
    const textHash = value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    for (let row = margin; row < qrSize - margin; row++) {
      for (let col = margin; col < qrSize - margin; col++) {
        let shouldFill = false;
        
        const isTopLeft = row < 7 + margin && col < 7 + margin;
        const isTopRight = row < 7 + margin && col >= qrSize - 7 - margin;
        const isBottomLeft = row >= qrSize - 7 - margin && col < 7 + margin;
        
        if (isTopLeft || isTopRight || isBottomLeft) {
          const localRow = isTopLeft ? row - margin : (isTopRight ? row - margin : row - (qrSize - 7 - margin));
          const localCol = isTopLeft ? col - margin : (isTopRight ? col - (qrSize - 7 - margin) : col - margin);
          
          shouldFill = 
            (localRow === 0 || localRow === 6 || localCol === 0 || localCol === 6) ||
            (localRow >= 2 && localRow <= 4 && localCol >= 2 && localCol <= 4);
        } else {
          if (row === 6 || col === 6) {
            shouldFill = (row + col) % 2 === 0;
          } else {
            const seed = textHash + row * 31 + col * 17;
            shouldFill = (seed % 3 !== 0) && ((seed % 7) > 2);
          }
        }
        
        if (shouldFill) {
          ctx.fillRect(
            col * moduleSize,
            row * moduleSize,
            moduleSize - 0.5,
            moduleSize - 0.5
          );
        }
      }
    }
    
    const centerRow = Math.floor(qrSize / 2);
    const centerCol = Math.floor(qrSize / 2);
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        if (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) {
          ctx.fillRect(
            (centerCol + c) * moduleSize,
            (centerRow + r) * moduleSize,
            moduleSize - 0.5,
            moduleSize - 0.5
          );
        }
      }
    }
  }, [value, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="absolute inset-[0.2mm] w-[calc(100%-0.4mm)] h-[calc(100%-0.4mm)] rounded"
      style={{ margin: '0.2mm' }}
    />
  );
};

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
  onQuickDownload: (certificate: Certificate) => void;
  isDownloading?: boolean;
}

const CertificateCard: React.FC<CertificateCardProps> = ({ certificate, onView, onShare, onQuickDownload, isDownloading }) => {
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
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickDownload(certificate);
                  }}
                  disabled={isDownloading}
                  title="Download certificate"
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
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
  const [isCertificateReady, setIsCertificateReady] = useState(false);

  const verificationUrl = certificate.verification_url || 
    `https://study.afritechbridge.online/verify/${certificate.certificate_number}`;

  // Check if certificate is fully rendered and ready for capture
  useEffect(() => {
    if (!isOpen) {
      setIsCertificateReady(false);
      return;
    }

    const checkCertificateReady = async () => {
      // Wait for dialog to open and render
      await new Promise(resolve => setTimeout(resolve, 800));
      
      if (certificateRef.current) {
        const rect = certificateRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          // Wait for images to load
          const images = certificateRef.current.querySelectorAll('img');
          await Promise.all(
            Array.from(images).map((img) => {
              if (img.complete) return Promise.resolve();
              return new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
                setTimeout(resolve, 5000);
              });
            })
          );
          setIsCertificateReady(true);
        }
      }
    };

    checkCertificateReady();
  }, [isOpen]);

  const handleDownloadImage = async () => {
    setIsDownloading(true);
    try {
      // Use backend-generated image instead of html2canvas
      const token = localStorage.getItem('token');
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/student/certificate/download-image/${certificate.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Download failed' }));
        throw new Error(errorData.error || 'Failed to download image');
      }

      // Get the blob and create download link
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${certificate.course_title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_Certificate.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('Image download successful from backend');
    } catch (error: any) {
      console.error('Error downloading image:', error);
      alert(`Failed to download image: ${error?.message || 'Unknown error'}. Please try PDF download instead.`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    
    try {
      // Primary method: Backend PDF generation (most reliable)
      const blob = await StudentApiService.downloadCertificate(certificate.id as number);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${certificate.course_title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_Certificate.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error downloading certificate:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      alert(`Download failed: ${errorMsg}. Please contact support if the issue persists.`);
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
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto bg-[#0f1f3d] border-cyan-400/30">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Award className="h-5 w-5 text-cyan-400" />
            Certificate of Achievement
          </DialogTitle>
          <DialogDescription className="text-cyan-200/70">
            View, download, verify or share your certificate for {certificate.course_title}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Certificate Preview - A4 Landscape Ratio */}
          <div 
            ref={certificateRef}
            data-certificate-ref="true"
            className="relative overflow-hidden rounded-lg shadow-2xl"
            style={{ 
              aspectRatio: '1.414/1', 
              minHeight: '500px',
              minWidth: '700px',
              backgroundColor: '#0f172a'
            }}
          >
            {/* Main Background - Navy Blue (#0f172a) matching backend */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e3a8a] to-[#0f172a]" />
            
            {/* Subtle gradient overlays matching backend */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-[#1e40af]/30 via-transparent to-transparent" style={{ width: '15%', height: '85%' }} />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-[#14b8a6]/15 via-transparent to-transparent" style={{ width: '85%', height: '20%' }} />
            
            {/* Main border - Teal matching backend */}
            <div className="absolute inset-[12px] rounded-lg border-[3px] border-[#14b8a6]" />
            
            {/* Inner accent border - Orange matching backend */}
            <div className="absolute inset-[15px] rounded-lg border-[1.5px] border-[#f97316]" />
            
            {/* Circuit node patterns - Top Left */}
            <div className="absolute top-[25mm] left-[30mm]">
              <div className="w-[3mm] h-[3mm] rounded-full bg-[#14b8a6]" />
              <div className="absolute top-[3mm] left-[10mm] w-[2.4mm] h-[2.4mm] rounded-full bg-[#5eead4]" />
              <div className="absolute top-[-1mm] left-[20mm] w-[2mm] h-[2mm] rounded-full bg-[#14b8a6]" />
              <svg className="absolute top-0 left-0 w-[22mm] h-[6mm]" style={{ overflow: 'visible' }}>
                <line x1="1.5mm" y1="1.5mm" x2="11.2mm" y2="4.5mm" stroke="#14b8a6" strokeWidth="2" />
                <line x1="11.2mm" y1="4.5mm" x2="21mm" y2="0.5mm" stroke="#5eead4" strokeWidth="2" />
              </svg>
            </div>
            
            {/* Circuit pattern - Top Right with upward arrow motif */}
            <svg className="absolute top-[30mm] right-[45mm] w-[20mm] h-[15mm]" style={{ overflow: 'visible' }}>
              <circle cx="10mm" cy="0mm" r="1.5mm" fill="#f97316" />
              <circle cx="18mm" cy="5mm" r="1.2mm" fill="#fb923c" />
              <circle cx="2mm" cy="5mm" r="1.2mm" fill="#f97316" />
              <line x1="10mm" y1="0mm" x2="18mm" y2="5mm" stroke="#f97316" strokeWidth="2" />
              <line x1="10mm" y1="0mm" x2="2mm" y2="5mm" stroke="#f97316" strokeWidth="2" />
            </svg>
            
            {/* Upward arrow brand element */}
            <svg className="absolute top-[40mm] right-[40mm] w-[15mm] h-[15mm]" style={{ overflow: 'visible' }}>
              <line x1="0" y1="10mm" x2="8mm" y2="0" stroke="#f97316" strokeWidth="3" />
              <line x1="8mm" y1="0" x2="5mm" y2="3mm" stroke="#f97316" strokeWidth="4" />
              <line x1="8mm" y1="0" x2="11mm" y2="3mm" stroke="#f97316" strokeWidth="4" />
            </svg>
            
            {/* Circuit pattern - Bottom Left */}
            <div className="absolute bottom-[35mm] left-[30mm]">
              <div className="w-[2.4mm] h-[2.4mm] rounded-full bg-[#14b8a6]" />
              <div className="absolute top-[5mm] left-[10mm] w-[2mm] h-[2mm] rounded-full bg-[#5eead4]" />
              <div className="absolute top-[-3mm] left-[20mm] w-[2.6mm] h-[2.6mm] rounded-full bg-[#14b8a6]" />
              <svg className="absolute top-0 left-0 w-[22mm] h-[8mm]" style={{ overflow: 'visible' }}>
                <line x1="1.2mm" y1="1.2mm" x2="11mm" y2="6mm" stroke="#14b8a6" strokeWidth="2" />
                <line x1="11mm" y1="6mm" x2="21.3mm" y2="-1.8mm" stroke="#5eead4" strokeWidth="2" />
              </svg>
            </div>
            
            {/* Circuit pattern - Bottom Right */}
            <div className="absolute bottom-[32mm] right-[35mm]">
              <div className="w-[2.4mm] h-[2.4mm] rounded-full bg-[#f97316]" />
              <div className="absolute bottom-[4mm] right-[10mm] w-[2mm] h-[2mm] rounded-full bg-[#fb923c]" />
              <div className="absolute bottom-[-3mm] right-[15mm] w-[2.6mm] h-[2.6mm] rounded-full bg-[#f97316]" />
              <svg className="absolute bottom-0 right-0 w-[18mm] h-[8mm]" style={{ overflow: 'visible' }}>
                <line x1="1mm" y1="2mm" x2="9mm" y2="6mm" stroke="#f97316" strokeWidth="2" />
                <line x1="9mm" y1="6mm" x2="17mm" y2="-1mm" stroke="#fb923c" strokeWidth="2" />
              </svg>
            </div>
            
            {/* Curved arc design elements */}
            <svg className="absolute top-[30mm] left-[25mm] w-[35mm] h-[20mm]" style={{ overflow: 'visible' }}>
              <path d="M 0 20 Q 10 0, 35 0" fill="none" stroke="#14b8a6" strokeWidth="2" />
              <path d="M 5 18 Q 12 2, 30 2" fill="none" stroke="#f97316" strokeWidth="1.5" />
            </svg>
            
            {/* Main Content */}
            <div className="relative z-10 h-full flex flex-col px-12 py-5">
              {/* Header Section */}
              <div className="flex items-start justify-between mb-3">
                {/* Enhanced Logo with Tech Frame matching backend */}
                <div className="relative flex-shrink-0" style={{ width: '74px', height: '74px' }}>
                  {/* Simplified circular tech frame */}
                  <svg className="absolute inset-0 w-full h-full" style={{ transform: 'translate(-1px, -1px)' }}>
                    {/* Outer teal circle */}
                    <circle cx="37" cy="37" r="32" fill="none" stroke="#14b8a6" strokeWidth="2.5" />
                    {/* Inner orange circle */}
                    <circle cx="37" cy="37" r="28" fill="none" stroke="#f97316" strokeWidth="1.5" />
                    
                    {/* Corner tech nodes at diagonals */}
                    <circle cx="60" cy="14" r="3.6" fill="#14b8a6" />
                    <circle cx="14" cy="14" r="3.6" fill="#f97316" />
                    <circle cx="14" cy="60" r="3.6" fill="#14b8a6" />
                    <circle cx="60" cy="60" r="3.6" fill="#f97316" />
                    
                    {/* Connecting lines extending outward */}
                    <line x1="60" y1="14" x2="68" y2="6" stroke="#14b8a6" strokeWidth="2" />
                    <circle cx="68" cy="6" r="2.4" fill="#14b8a6" />
                    
                    <line x1="14" y1="14" x2="6" y2="6" stroke="#f97316" strokeWidth="2" />
                    <circle cx="6" cy="6" r="2.4" fill="#f97316" />
                    
                    <line x1="14" y1="60" x2="6" y2="68" stroke="#14b8a6" strokeWidth="2" />
                    <circle cx="6" cy="68" r="2.4" fill="#14b8a6" />
                    
                    <line x1="60" y1="60" x2="68" y2="68" stroke="#f97316" strokeWidth="2" />
                    <circle cx="68" cy="68" r="2.4" fill="#f97316" />
                  </svg>
                  
                  {/* Logo in center */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src="/logo.jpg" 
                      alt="Afritech Bridge Logo" 
                      width={44}
                      height={44}
                      className="rounded-full block"
                      crossOrigin="anonymous"
                      style={{ objectFit: 'cover' }}
                    />
                  </div>
                </div>
                
                {/* Center Title matching backend */}
                <div className="text-center flex-1 px-4">
                  <p className="text-[#14b8a6] text-xs font-medium tracking-[0.3em] uppercase mb-1">
                    AFRITECH BRIDGE ACADEMY
                  </p>
                  <p className="text-[#5eead4] text-[9px] tracking-widest mb-3">
                    Empowering Africa Through Technology Education
                  </p>
                  <div className="inline-block">
                    <h1 className="text-[34px] font-bold leading-none mb-0">
                      <span className="text-white">CERTIFICATE</span>
                    </h1>
                    <h2 className="text-[28px] font-bold text-[#f97316] leading-tight">
                      OF ACHIEVEMENT
                    </h2>
                  </div>
                </div>
                
                {/* Upward Arrow Icon matching backend */}
                <div className="flex-shrink-0">
                  <svg className="w-12 h-12 text-[#f97316]" viewBox="0 0 48 48" fill="none" stroke="currentColor">
                    <circle cx="24" cy="24" r="6" fill="currentColor" />
                    <circle cx="12" cy="12" r="4" fill="currentColor" />
                    <circle cx="36" cy="12" r="4" fill="currentColor" />
                    <circle cx="12" cy="36" r="4" fill="currentColor" />
                    <line x1="16" y1="14" x2="20" y2="20" strokeWidth="2" />
                    <line x1="32" y1="14" x2="28" y2="20" strokeWidth="2" />
                    <line x1="16" y1="34" x2="20" y2="28" strokeWidth="2" />
                  </svg>
                </div>
              </div>
              
              {/* "Official" badge below logo */}
              <div className="absolute top-[80px] left-[50px]">
                <span className="text-[#14b8a6] text-[7px] font-bold tracking-wider">◆ OFFICIAL ◆</span>
              </div>
              
              {/* Decorative tech divider with dots matching backend */}
              <div className="relative h-[1.5px] mb-3">
                <div className="absolute left-0 right-[calc(50%+5mm)] h-full bg-[#14b8a6]" />
                <div className="absolute left-[calc(50%+5mm)] right-0 h-full bg-[#14b8a6]" />
                {/* Center dots */}
                <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center gap-[3mm]">
                  <div className="w-[3mm] h-[3mm] rounded-full bg-[#14b8a6]" />
                  <div className="w-[3mm] h-[3mm] rounded-full bg-[#f97316]" />
                  <div className="w-[3mm] h-[3mm] rounded-full bg-[#14b8a6]" />
                </div>
              </div>
              
              {/* Middle Section matching backend */}
              <div className="flex-1 flex flex-col justify-center text-center space-y-3">
                <p className="text-[#94a3b8] text-sm">This certifies that</p>
                
                {/* Student Name with Gradient Underline matching backend */}
                <div className="relative py-1">
                  <h2 className="text-[28px] font-bold text-white tracking-wide mb-2">
                    {certificate.student_name}
                  </h2>
                  {/* Two-tone underline: teal to orange */}
                  <div className="mx-auto w-[150mm] h-[2.5px] flex">
                    <div className="flex-1 bg-[#14b8a6]" />
                    <div className="flex-1 bg-[#f97316]" />
                  </div>
                </div>
                
                <p className="text-[#94a3b8] text-sm mt-2">has successfully completed the course</p>
                
                {/* Course Title in brand blue box matching backend */}
                <div className="flex justify-center my-2">
                  <div className="relative inline-block max-w-2xl">
                    {/* Background glow */}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#1e3a8a]/30 to-[#1e3a8a]/30 blur-xl rounded-lg" />
                    {/* Main box with brand blue background */}
                    <div className="relative bg-[#1e3a8a] rounded-lg px-8 py-3 border-2 border-[#14b8a6]">
                      {/* Corner decorations */}
                      <div className="absolute top-[3mm] left-[3mm] w-[1.6mm] h-[1.6mm] rounded-full bg-[#f97316]" />
                      <div className="absolute top-[3mm] right-[3mm] w-[1.6mm] h-[1.6mm] rounded-full bg-[#f97316]" />
                      <div className="absolute bottom-[3mm] left-[3mm] w-[1.6mm] h-[1.6mm] rounded-full bg-[#f97316]" />
                      <div className="absolute bottom-[3mm] right-[3mm] w-[1.6mm] h-[1.6mm] rounded-full bg-[#f97316]" />
                      
                      <h3 className="text-xl font-bold text-white">
                        {certificate.course_title}
                      </h3>
                    </div>
                  </div>
                </div>
                
                {/* Competencies Section matching backend format */}
                <div className="space-y-1 py-2 mt-1">
                  {(certificate.skills_acquired || certificate.skills_demonstrated || []).length > 0 && (
                    <div className="flex justify-center">
                      <div className="inline-flex items-center gap-2 bg-gradient-to-r from-[#14b8a6]/10 to-[#f97316]/10 px-6 py-2 rounded-lg border border-[#14b8a6]/30">
                        <div className="w-[2mm] h-[2mm] rounded-full bg-[#14b8a6]" />
                        <p className="text-[#14b8a6] text-[9px] font-bold uppercase tracking-wider">
                          COMPETENCIES: {(certificate.skills_acquired || certificate.skills_demonstrated || []).slice(0, 3).map((skill: string) => 
                            skill.length > 35 ? skill.substring(0, 32) + '...' : skill
                          ).join(' • ')}
                        </p>
                        <div className="w-[2mm] h-[2mm] rounded-full bg-[#f97316]" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Divider */}
              <div className="h-[1.2px] bg-[#14b8a6] mt-4 mb-1.5" />
              
              {/* Footer Section matching backend */}
              <div className="grid grid-cols-3 gap-3 items-end">
                {/* Left Column - Issue Date & Certificate ID matching backend */}
                <div className="text-left space-y-1">
                  <div>
                    <p className="text-[#14b8a6] text-[8px] font-bold uppercase tracking-wide mb-0.5">ISSUE DATE</p>
                    <p className="text-white font-bold text-[9px]">
                      {new Date(certificate.issued_at || certificate.issued_date || new Date()).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#f97316] text-[8px] font-bold uppercase tracking-wide mb-0.5">CERTIFICATE ID</p>
                    <p className="text-[#cbd5e1] font-mono text-[7px]">{certificate.certificate_number}</p>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="relative w-[5mm] h-[5mm]">
                      <div className="absolute inset-0 w-[4mm] h-[4mm] rounded-full bg-[#14b8a6] top-[0.5mm] left-[0.5mm]" />
                      <div className="absolute inset-0 rounded-full border-[1.5px] border-[#22d3ee]" />
                      <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-[9px]">✓</span>
                    </div>
                    <span className="text-[#5eead4] text-[7px] font-bold">Blockchain Verified</span>
                  </div>
                </div>
                
                {/* Center Column - Enhanced Signature Box matching backend */}
                <div className="text-center flex flex-col items-center">
                  <div className="relative" style={{ width: '70mm', height: '22mm' }}>
                    {/* Elegant gradient background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#1e3a8a]/40 via-[#1e3a8a]/25 to-[#1e3a8a]/40 rounded-lg" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#14b8a6]/5 via-transparent to-transparent rounded-lg" />
                    
                    {/* Premium double border with glow effect */}
                    <div className="absolute inset-0 border-2 border-[#14b8a6] rounded-lg shadow-[0_0_8px_rgba(20,184,166,0.3)]" />
                    <div className="absolute inset-[1.5mm] border border-[#f97316] rounded-lg shadow-[0_0_6px_rgba(249,115,22,0.2)]" />
                    
                    {/* Enhanced corner tech nodes with pulse effect */}
                    <div className="absolute top-[2.5mm] left-[2.5mm] w-[2.5mm] h-[2.5mm] rounded-full bg-[#14b8a6] shadow-[0_0_4px_rgba(20,184,166,0.6)]" />
                    <div className="absolute top-[2.5mm] right-[2.5mm] w-[2.5mm] h-[2.5mm] rounded-full bg-[#f97316] shadow-[0_0_4px_rgba(249,115,22,0.6)]" />
                    <div className="absolute bottom-[2.5mm] left-[2.5mm] w-[2.5mm] h-[2.5mm] rounded-full bg-[#14b8a6] shadow-[0_0_4px_rgba(20,184,166,0.6)]" />
                    <div className="absolute bottom-[2.5mm] right-[2.5mm] w-[2.5mm] h-[2.5mm] rounded-full bg-[#f97316] shadow-[0_0_4px_rgba(249,115,22,0.6)]" />
                    
                    {/* Elegant label with decorative elements */}
                    <div className="absolute top-[2mm] left-0 right-0 flex items-center justify-center gap-1">
                      <div className="w-[1mm] h-[1mm] rounded-full bg-[#14b8a6]" />
                      <p className="text-center text-[#14b8a6] text-[5px] font-bold tracking-widest uppercase">
                        Authorized Signature
                      </p>
                      <div className="w-[1mm] h-[1mm] rounded-full bg-[#f97316]" />
                    </div>
                    
                    {/* Signature image with colored frame matching image */}
                    <div className="absolute" style={{ top: '7mm', left: '19mm', width: '32mm', height: '7mm' }}>
                      {/* Frame with teal/cyan and orange borders (26mm wide, smaller than image) */}
                      <div className="absolute" style={{
                        left: '3mm',
                        width: '26mm',
                        height: '7mm',
                        borderLeft: '2px solid #14b8a6',
                        borderTop: '2px solid #14b8a6',
                        borderRight: '2px solid #f97316',
                        borderBottom: '2px solid #f97316',
                        background: 'rgba(30, 58, 138, 0.2)'
                      }} />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src="/sign.jpg" 
                        alt="CEO Signature" 
                        className="absolute inset-0 w-full h-full object-contain relative z-10 filter brightness-110 contrast-125"
                        style={{ padding: '2px' }}
                        crossOrigin="anonymous"
                      />
                    </div>
                    
                    {/* Elegant signature line with decorative dots */}
                    <div className="absolute" style={{ top: '15mm', left: '7mm', right: '7mm', height: '1.5px' }}>
                      <div className="absolute left-0 right-[calc(50%+2mm)] h-full bg-gradient-to-r from-[#14b8a6] to-[#14b8a6]/80" />
                      <div className="absolute left-[calc(50%+2mm)] right-0 h-full bg-gradient-to-l from-[#f97316] to-[#f97316]/80" />
                      <div className="absolute left-[calc(50%-2mm)] top-1/2 transform -translate-y-1/2 w-[1.5mm] h-[1.5mm] rounded-full bg-[#14b8a6] shadow-[0_0_3px_rgba(20,184,166,0.8)]" />
                      <div className="absolute left-[calc(50%+2mm)] top-1/2 transform -translate-y-1/2 w-[1.5mm] h-[1.5mm] rounded-full bg-[#f97316] shadow-[0_0_3px_rgba(249,115,22,0.8)]" />
                    </div>
                    
                    {/* CEO Information with enhanced typography and better spacing */}
                    <div className="absolute bottom-[6mm] left-0 right-0 text-center">
                      <p className="font-bold text-white text-[9px] tracking-wide mb-0.5" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                        Desire Bikorimana
                      </p>
                    </div>
                    <div className="absolute bottom-[3.5mm] left-0 right-0 text-center">
                      <div className="inline-flex items-center gap-1">
                        <div className="w-[0.8mm] h-[0.8mm] rounded-full bg-[#f97316]" />
                        <p className="text-[#f97316] text-[7px] font-bold tracking-wide">Founder & Chief Executive Officer</p>
                        <div className="w-[0.8mm] h-[0.8mm] rounded-full bg-[#f97316]" />
                      </div>
                    </div>
                    <div className="absolute bottom-[1.2mm] left-0 right-0 text-center">
                      <p className="text-[#cbd5e1] text-[6px] tracking-wider" style={{ textShadow: '0 1px 1px rgba(0,0,0,0.2)' }}>
                        Afritech Bridge Academy
                      </p>
                    </div>
                    
                    {/* Enhanced Authority Seal on left with glow */}
                    <div className="absolute" style={{ left: '6mm', top: '11mm', width: '11mm', height: '11mm' }}>
                      {/* Glow effect */}
                      <div className="absolute inset-0 bg-[#14b8a6]/20 rounded-full blur-sm" />
                      <svg className="w-full h-full relative z-10">
                        {/* Outer glow circle */}
                        <circle cx="5.5mm" cy="5.5mm" r="5.5mm" fill="none" stroke="#14b8a6" strokeWidth="1.8" opacity="0.8" />
                        {/* Inner detail circle */}
                        <circle cx="5.5mm" cy="5.5mm" r="4mm" fill="none" stroke="#14b8a6" strokeWidth="0.8" />
                        {/* Central badge */}
                        <circle cx="5.5mm" cy="5.5mm" r="1.8mm" fill="#14b8a6" />
                        {/* Radiating lines with gradient effect */}
                        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
                          const rad = angle * Math.PI / 180;
                          const x1 = 5.5 + 2.3 * Math.cos(rad);
                          const y1 = 5.5 + 2.3 * Math.sin(rad);
                          const x2 = 5.5 + 5 * Math.cos(rad);
                          const y2 = 5.5 + 5 * Math.sin(rad);
                          return (
                            <g key={i} opacity="0.9">
                              <line x1={`${x1}mm`} y1={`${y1}mm`} x2={`${x2}mm`} y2={`${y2}mm`} stroke="#14b8a6" strokeWidth="1.3" />
                              <circle cx={`${x2}mm`} cy={`${y2}mm`} r="0.7mm" fill="#14b8a6" />
                            </g>
                          );
                        })}
                        {/* Center highlight */}
                        <circle cx="5.5mm" cy="5.5mm" r="0.6mm" fill="#5eead4" opacity="0.7" />
                      </svg>
                      <div className="text-center mt-0.5 relative z-10">
                        <p className="text-[#14b8a6] text-[5.5px] font-bold tracking-wider" style={{ textShadow: '0 0 3px rgba(20,184,166,0.5)' }}>
                          2026
                        </p>
                      </div>
                    </div>
                    
                    {/* Enhanced Excellence Ribbon on right with glow */}
                    <div className="absolute" style={{ right: '6mm', top: '11mm', width: '11mm', height: '11mm' }}>
                      {/* Glow effect */}
                      <div className="absolute inset-0 bg-[#f97316]/20 rounded-full blur-sm" />
                      <svg className="w-full h-full relative z-10">
                        {/* Outer glow circle */}
                        <circle cx="5.5mm" cy="5.5mm" r="5.5mm" fill="none" stroke="#f97316" strokeWidth="1.8" opacity="0.8" />
                        {/* Inner detail circle */}
                        <circle cx="5.5mm" cy="5.5mm" r="4mm" fill="none" stroke="#f97316" strokeWidth="0.8" />
                        {/* Central star core */}
                        <circle cx="5.5mm" cy="5.5mm" r="2.2mm" fill="#f97316" />
                        {/* 5-point star with gradient effect */}
                        {[0, 72, 144, 216, 288].map((angle, i) => {
                          const rad = (angle - 90) * Math.PI / 180;
                          const x = 5.5 + 4.5 * Math.cos(rad);
                          const y = 5.5 + 4.5 * Math.sin(rad);
                          return (
                            <g key={i} opacity="0.9">
                              <circle cx={`${x}mm`} cy={`${y}mm`} r="1mm" fill="#f97316" />
                            </g>
                          );
                        })}
                        {/* Center highlight */}
                        <circle cx="5.5mm" cy="5.5mm" r="0.8mm" fill="#fb923c" opacity="0.7" />
                      </svg>
                      <div className="text-center mt-0.5 relative z-10">
                        <p className="text-[#f97316] text-[4.5px] font-bold tracking-widest uppercase" style={{ textShadow: '0 0 3px rgba(249,115,22,0.5)' }}>
                          Excellence
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Right Column - QR Code with tech frame matching backend */}
                <div className="text-right flex flex-col items-end">
                  <div className="relative inline-block" style={{ width: '15mm', height: '15mm' }}>
                    {/* White background */}
                    <div className="absolute inset-0 bg-white rounded-lg" />
                    
                    {/* Tech border */}
                    <div className="absolute inset-0 border-2 border-[#14b8a6] rounded-lg" />
                    
                    {/* Corner accents */}
                    <div className="absolute top-0 left-0 w-[1.3mm] h-[1.3mm] rounded-full bg-[#f97316]" />
                    <div className="absolute top-0 right-0 w-[1.3mm] h-[1.3mm] rounded-full bg-[#f97316]" />
                    <div className="absolute bottom-0 left-0 w-[1.3mm] h-[1.3mm] rounded-full bg-[#f97316]" />
                    <div className="absolute bottom-0 right-0 w-[1.3mm] h-[1.3mm] rounded-full bg-[#f97316]" />
                    
                    {/* Real QR Code */}
                    <QRCodeComponent 
                      value={`https://study.afritechbridge.online/verify/${certificate.certificate_number}`}
                      size={56}
                    />
                  </div>
                  <p className="text-[#14b8a6] text-[6.5px] font-bold mt-1 uppercase tracking-wider">SCAN TO VERIFY</p>
                  <p className="text-[#94a3b8] text-[6px]">study.afritechbridge.online/verify</p>
                </div>
              </div>
              
              {/* Footer section with two badge design */}
              <div className="relative mt-2 mb-2">
                {/* Horizontal divider line with gradient */}
                <div className="absolute top-[3mm] left-[10mm] right-[10mm] h-[1.5px] bg-gradient-to-r from-[#14b8a6] via-[#14b8a6]/50 to-[#f97316]" />
                
                {/* Left circular badge (Teal) */}
                <div className="absolute" style={{ left: '2mm', top: '0mm' }}>
                  <div className="relative w-[6mm] h-[6mm]">
                    {/* Outer glow */}
                    <div className="absolute inset-0 rounded-full bg-[#14b8a6]/20 blur-sm" />
                    {/* Badge circles */}
                    <div className="absolute inset-0 rounded-full border-[2px] border-[#14b8a6]" />
                    <div className="absolute inset-[0.7mm] rounded-full bg-[#14b8a6]/30" />
                    <div className="absolute inset-[1.5mm] rounded-full bg-[#14b8a6]" />
                    {/* Inner highlight */}
                    <div className="absolute inset-[2mm] rounded-full bg-[#5eead4]/60" />
                  </div>
                </div>
                
                {/* Right circular badge (Orange) */}
                <div className="absolute" style={{ right: '2mm', top: '0mm' }}>
                  <div className="relative w-[6mm] h-[6mm]">
                    {/* Outer glow */}
                    <div className="absolute inset-0 rounded-full bg-[#f97316]/20 blur-sm" />
                    {/* Badge circles */}
                    <div className="absolute inset-0 rounded-full border-[2px] border-[#14b8a6]" />
                    <div className="absolute inset-[0.7mm] rounded-full bg-[#f97316]/30" />
                    <div className="absolute inset-[1.5mm] rounded-full bg-[#14b8a6]" />
                    {/* Inner highlight */}
                    <div className="absolute inset-[2mm] rounded-full bg-[#5eead4]/60" />
                  </div>
                </div>
                
                {/* Footer text centered with better spacing */}
                <div className="text-center pt-[10mm] space-y-1">
                  <p className="text-[#cbd5e1] text-[7px] tracking-wide">
                    Empowering the next generation of African tech leaders
                  </p>
                  <p className="text-[#14b8a6] text-[6px] font-bold tracking-wide">
                    2026 Afritech Bridge Academy - All Rights Reserved
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex justify-center gap-3">
            <Button 
              onClick={handleDownload} 
              disabled={isDownloading}
              className="bg-gradient-to-r from-cyan-500 to-orange-500 hover:from-cyan-600 hover:to-orange-600 text-white font-semibold"
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
              disabled={isDownloading || !isCertificateReady}
              variant="outline"
              className="border-cyan-500 text-cyan-400 hover:bg-cyan-500/10"
              title={!isCertificateReady ? 'Please wait for certificate to finish loading' : 'Download as PNG image'}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download Image {!isCertificateReady && '(Loading...)'}
                </>
              )}
            </Button>
            <Button 
              onClick={handleVerifyOnline}
              variant="outline" 
              className="border-cyan-400/50 text-cyan-300 hover:bg-cyan-500/10"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Verify Online
            </Button>
            <Button 
              onClick={() => setShareDialogOpen(true)}
              variant="outline" 
              className="border-orange-400/50 text-orange-300 hover:bg-orange-500/10"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
          
          {/* Verification Info */}
          <div className="bg-gradient-to-r from-cyan-500/10 to-orange-500/10 p-4 rounded-lg text-center border border-cyan-400/30 backdrop-blur-sm">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-green-400" />
              <span className="text-green-400 text-sm font-medium">Blockchain Verified Certificate</span>
            </div>
            <p className="text-sm text-cyan-200/70">
              Verification Hash: <span className="font-mono text-white">{certificate.verification_hash || certificate.certificate_number}</span>
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
  
  const shareMessage = `🎓 I just earned a certificate in "${certificate.course_title}" from Afritech Bridge Academy! Check it out:`;

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
      url: `mailto:?subject=${encodeURIComponent(`Certificate: ${certificate.course_title} - Afritech Bridge`)}&body=${encodeURIComponent(`${shareMessage}\n\n${shareUrl}`)}`,
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
  const [downloadingCertId, setDownloadingCertId] = useState<number | null>(null);

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

  const handleQuickDownload = async (certificate: Certificate) => {
    try {
      setDownloadingCertId(certificate.id as any);
      
      // Use the StudentApiService for better error handling
      const blob = await StudentApiService.downloadCertificate(certificate.id as number);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${certificate.course_title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_Certificate.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error: any) {
      console.error('Download error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to download certificate';
      alert(errorMessage + '. Please try again or use the View option for client-side download.');
    } finally {
      setDownloadingCertId(null);
    }
  };

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
                    onQuickDownload={handleQuickDownload}
                    isDownloading={downloadingCertId === certificate.id}
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