'use client';

import React, { useState } from 'react';
import { Download, Share2, FileImage, FileText, Link, Mail, MessageCircle, Loader2 } from 'lucide-react';
import { Certificate, CertificateDownloadService } from '../../utils/certificate-download';
import { CertificateShareService, ShareOptions } from '../../utils/certificate-share';

interface CertificateActionsProps {
  certificate: Certificate;
  onDownloadStart?: () => void;
  onDownloadComplete?: () => void;
  onDownloadError?: (error: string) => void;
  onShareComplete?: (platform: string) => void;
}

export const CertificateActions: React.FC<CertificateActionsProps> = ({
  certificate,
  onDownloadStart,
  onDownloadComplete,
  onDownloadError,
  onShareComplete
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const handleDownload = async (format: 'pdf' | 'png' | 'jpg') => {
    try {
      setIsDownloading(true);
      onDownloadStart?.();

      const elementId = `certificate-${certificate.id}`;

      if (format === 'pdf') {
        await CertificateDownloadService.downloadCertificateAsPDF(certificate, elementId);
      } else {
        await CertificateDownloadService.downloadCertificateAsImage(certificate, elementId, format);
      }

      onDownloadComplete?.();
      setShowDownloadMenu(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Download failed';
      onDownloadError?.(errorMessage);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = (platform: ShareOptions['platform'], messageTemplate?: 'professional' | 'casual' | 'achievement') => {
    try {
      const shareOptions: ShareOptions = {
        platform,
        message: messageTemplate 
          ? CertificateShareService.generateCustomMessage(certificate, messageTemplate)
          : undefined
      };

      CertificateShareService.shareCertificate(certificate, shareOptions);
      onShareComplete?.(platform);
      setShowShareMenu(false);
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  return (
    <div className="flex gap-2 relative">
      {/* Download Button */}
      <div className="relative">
        <button
          onClick={() => setShowDownloadMenu(!showDownloadMenu)}
          disabled={isDownloading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDownloading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {isDownloading ? 'Downloading...' : 'Download'}
        </button>

        {/* Download Menu */}
        {showDownloadMenu && !isDownloading && (
          <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-48">
            <button
              onClick={() => handleDownload('pdf')}
              className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <FileText className="w-4 h-4 text-red-500" />
              <div className="text-left">
                <div className="font-medium">PDF Document</div>
                <div className="text-sm text-gray-500">Best for printing</div>
              </div>
            </button>
            <button
              onClick={() => handleDownload('png')}
              className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <FileImage className="w-4 h-4 text-blue-500" />
              <div className="text-left">
                <div className="font-medium">PNG Image</div>
                <div className="text-sm text-gray-500">High quality, transparent background</div>
              </div>
            </button>
            <button
              onClick={() => handleDownload('jpg')}
              className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 transition-colors border-t border-gray-100"
            >
              <FileImage className="w-4 h-4 text-green-500" />
              <div className="text-left">
                <div className="font-medium">JPG Image</div>
                <div className="text-sm text-gray-500">Smaller file size</div>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Share Button */}
      <div className="relative">
        <button
          onClick={() => setShowShareMenu(!showShareMenu)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>

        {/* Share Menu */}
        {showShareMenu && (
          <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-56">
            <div className="p-3 border-b border-gray-100">
              <h3 className="font-medium text-gray-900">Share Certificate</h3>
              <p className="text-sm text-gray-500">Choose a platform to share your achievement</p>
            </div>
            
            {/* Social Media Platforms */}
            <div className="p-2">
              <button
                onClick={() => handleShare('linkedin', 'professional')}
                className="flex items-center gap-3 w-full px-3 py-2 hover:bg-gray-50 rounded-md transition-colors"
              >
                <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">in</span>
                </div>
                <div className="text-left">
                  <div className="font-medium">LinkedIn</div>
                  <div className="text-sm text-gray-500">Professional network</div>
                </div>
              </button>

              <button
                onClick={() => handleShare('twitter', 'achievement')}
                className="flex items-center gap-3 w-full px-3 py-2 hover:bg-gray-50 rounded-md transition-colors"
              >
                <div className="w-8 h-8 bg-sky-500 rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">𝕏</span>
                </div>
                <div className="text-left">
                  <div className="font-medium">Twitter / X</div>
                  <div className="text-sm text-gray-500">Share with followers</div>
                </div>
              </button>

              <button
                onClick={() => handleShare('facebook', 'casual')}
                className="flex items-center gap-3 w-full px-3 py-2 hover:bg-gray-50 rounded-md transition-colors"
              >
                <div className="w-8 h-8 bg-blue-800 rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">f</span>
                </div>
                <div className="text-left">
                  <div className="font-medium">Facebook</div>
                  <div className="text-sm text-gray-500">Share with friends</div>
                </div>
              </button>

              <button
                onClick={() => handleShare('whatsapp')}
                className="flex items-center gap-3 w-full px-3 py-2 hover:bg-gray-50 rounded-md transition-colors"
              >
                <MessageCircle className="w-8 h-8 text-green-500" />
                <div className="text-left">
                  <div className="font-medium">WhatsApp</div>
                  <div className="text-sm text-gray-500">Send to contacts</div>
                </div>
              </button>
            </div>

            <div className="border-t border-gray-100 p-2">
              <button
                onClick={() => handleShare('email')}
                className="flex items-center gap-3 w-full px-3 py-2 hover:bg-gray-50 rounded-md transition-colors"
              >
                <Mail className="w-8 h-8 text-gray-600" />
                <div className="text-left">
                  <div className="font-medium">Email</div>
                  <div className="text-sm text-gray-500">Send via email</div>
                </div>
              </button>

              <button
                onClick={() => handleShare('copy')}
                className="flex items-center gap-3 w-full px-3 py-2 hover:bg-gray-50 rounded-md transition-colors"
              >
                <Link className="w-8 h-8 text-gray-600" />
                <div className="text-left">
                  <div className="font-medium">Copy Link</div>
                  <div className="text-sm text-gray-500">Copy to clipboard</div>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close menus */}
      {(showDownloadMenu || showShareMenu) && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => {
            setShowDownloadMenu(false);
            setShowShareMenu(false);
          }}
        />
      )}
    </div>
  );
};

export default CertificateActions;