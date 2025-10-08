"use client";

import React, { useState, useEffect, useRef } from 'react';
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
  FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { StudentApiService, Certificate, SkillBadge } from '@/services/studentApi';
import Link from 'next/link';
import Image from 'next/image';

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
  certificate: Certificate;
  onView: (certificate: Certificate) => void;
  onShare: (certificate: Certificate) => void;
}

const CertificateCard: React.FC<CertificateCardProps> = ({ certificate, onView, onShare }) => {
  return (
    <motion.div variants={itemVariants}>
      <Card className="group hover:shadow-2xl transition-all duration-500 hover:scale-105 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 opacity-50" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-yellow-200/20 to-transparent rounded-full -translate-y-16 translate-x-16" />
        
        <CardContent className="p-6 relative">
          <div className="space-y-4">
            {/* Header with Icon */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full">
                  <GraduationCap className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{certificate.course_title}</h3>
                  <p className="text-sm text-muted-foreground">Course Certificate</p>
                </div>
              </div>
              <Badge className="bg-green-100 text-green-800 border-green-200">
                <Verified className="h-3 w-3 mr-1" />
                Verified
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
                  {new Date(certificate.issued_date).toLocaleDateString()}
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Certificate ID: {certificate.certificate_number}
              </div>

              {/* Skills */}
              <div className="flex flex-wrap gap-1">
                {certificate.skills_demonstrated.slice(0, 3).map((skill, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {skill}
                  </Badge>
                ))}
                {certificate.skills_demonstrated.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{certificate.skills_demonstrated.length - 3} more
                  </Badge>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-2 pt-2">
              <Button size="sm" onClick={() => onView(certificate)} className="flex-1">
                <Eye className="h-4 w-4 mr-2" />
                View
              </Button>
              <Button size="sm" variant="outline" onClick={() => onShare(certificate)}>
                <Share2 className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4" />
              </Button>
            </div>
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

  const handleDownload = () => {
    // In a real implementation, you would generate and download the PDF
    console.log('Downloading certificate:', certificate.certificate_number);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Certificate of Completion</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Certificate Preview */}
          <div 
            ref={certificateRef}
            className="bg-gradient-to-br from-blue-50 via-white to-purple-50 p-12 border-8 border-yellow-400 relative"
            style={{ aspectRatio: '16/11' }}
          >
            {/* Decorative elements */}
            <div className="absolute top-4 left-4 w-8 h-8 border-4 border-yellow-400 rounded-full" />
            <div className="absolute top-4 right-4 w-8 h-8 border-4 border-yellow-400 rounded-full" />
            <div className="absolute bottom-4 left-4 w-8 h-8 border-4 border-yellow-400 rounded-full" />
            <div className="absolute bottom-4 right-4 w-8 h-8 border-4 border-yellow-400 rounded-full" />
            
            <div className="text-center space-y-6 relative">
              {/* Header */}
              <div className="space-y-2">
                <div className="flex justify-center">
                  <div className="p-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full">
                    <GraduationCap className="h-12 w-12 text-white" />
                  </div>
                </div>
                <h1 className="text-4xl font-bold text-gray-800">Certificate of Completion</h1>
                <p className="text-lg text-gray-600">This certifies that</p>
              </div>
              
              {/* Student Name */}
              <div className="py-4 border-b-2 border-gray-300 mx-8">
                <h2 className="text-3xl font-bold text-blue-800">{certificate.student_name}</h2>
              </div>
              
              {/* Course Details */}
              <div className="space-y-2">
                <p className="text-lg text-gray-600">has successfully completed the course</p>
                <h3 className="text-2xl font-bold text-gray-800">{certificate.course_title}</h3>
                <p className="text-gray-600">demonstrating proficiency in:</p>
                
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {certificate.skills_demonstrated.map((skill, index) => (
                    <Badge key={index} variant="secondary" className="text-sm">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
              
              {/* Footer */}
              <div className="flex justify-between items-end mt-12 text-sm text-gray-600">
                <div>
                  <p>Date Issued:</p>
                  <p className="font-semibold">{new Date(certificate.issued_date).toLocaleDateString()}</p>
                </div>
                <div className="text-center">
                  <div className="w-32 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mb-2">
                    <span className="text-white font-bold">AFRITEC</span>
                  </div>
                  <p>Authorized Signature</p>
                </div>
                <div>
                  <p>Certificate ID:</p>
                  <p className="font-semibold text-xs">{certificate.certificate_number}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex justify-center space-x-4">
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button variant="outline">
              <ExternalLink className="h-4 w-4 mr-2" />
              Verify Online
            </Button>
            <Button variant="outline">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
          
          {/* Verification Info */}
          <div className="bg-muted/50 p-4 rounded-lg text-center">
            <p className="text-sm text-muted-foreground">
              This certificate can be verified at: {certificate.verification_url}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface ShareDialogProps {
  certificate: Certificate;
  isOpen: boolean;
  onClose: () => void;
}

const ShareDialog: React.FC<ShareDialogProps> = ({ certificate, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const shareUrl = certificate.verification_url;

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
      url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`I just earned a certificate in ${certificate.course_title}!`)}`,
      color: 'bg-sky-500 hover:bg-sky-600'
    },
    {
      name: 'Facebook',
      icon: <Facebook className="h-5 w-5" />,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      color: 'bg-blue-800 hover:bg-blue-900'
    },
    {
      name: 'Email',
      icon: <Mail className="h-5 w-5" />,
      url: `mailto:?subject=${encodeURIComponent(`Certificate: ${certificate.course_title}`)}&body=${encodeURIComponent(`Check out my certificate: ${shareUrl}`)}`,
      color: 'bg-gray-600 hover:bg-gray-700'
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Certificate</DialogTitle>
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [certsData, badgesData] = await Promise.all([
          StudentApiService.getCertificates(),
          StudentApiService.getBadges()
        ]);
        setCertificates(Array.isArray(certsData) ? certsData : []);
        setBadges(Array.isArray(badgesData) ? badgesData : []);
      } catch (error) {
        console.error('Failed to fetch certificate data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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