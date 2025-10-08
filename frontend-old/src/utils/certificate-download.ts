import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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

export class CertificateDownloadService {
  /**
   * Generate and download certificate as PDF
   */
  static async downloadCertificateAsPDF(certificate: Certificate, elementId: string): Promise<void> {
    try {
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error('Certificate element not found');
      }

      // Create canvas from the certificate element
      const canvas = await html2canvas(element, {
        scale: 2,
        allowTaint: true,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: 800,
        height: 600
      });

      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 297; // A4 landscape width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      
      // Download the PDF
      const fileName = `${certificate.courseTitle.replace(/\s+/g, '_')}_Certificate_${certificate.credentialId}.pdf`;
      pdf.save(fileName);

      // Track download event
      this.trackDownload(certificate.id, 'pdf');
    } catch (error) {
      console.error('Error downloading certificate as PDF:', error);
      throw new Error('Failed to download certificate. Please try again.');
    }
  }

  /**
   * Download certificate as high-quality image
   */
  static async downloadCertificateAsImage(certificate: Certificate, elementId: string, format: 'png' | 'jpg' = 'png'): Promise<void> {
    try {
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error('Certificate element not found');
      }

      const canvas = await html2canvas(element, {
        scale: 3,
        allowTaint: true,
        useCORS: true,
        backgroundColor: format === 'jpg' ? '#ffffff' : null,
        width: 1200,
        height: 900
      });

      // Create download link
      const link = document.createElement('a');
      link.download = `${certificate.courseTitle.replace(/\s+/g, '_')}_Certificate_${certificate.credentialId}.${format}`;
      link.href = canvas.toDataURL(`image/${format}`, 0.95);
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Track download event
      this.trackDownload(certificate.id, format);
    } catch (error) {
      console.error(`Error downloading certificate as ${format}:`, error);
      throw new Error('Failed to download certificate. Please try again.');
    }
  }

  /**
   * Generate shareable certificate URL
   */
  static generateShareableUrl(certificate: Certificate): string {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/verify-certificate/${certificate.credentialId}`;
  }

  /**
   * Verify certificate authenticity
   */
  static async verifyCertificate(credentialId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/v1/certificates/verify/${credentialId}`);
      const data = await response.json() as { isValid: boolean };
      return data.isValid;
    } catch (error) {
      console.error('Error verifying certificate:', error);
      return false;
    }
  }

  /**
   * Track download events for analytics
   */
  private static trackDownload(certificateId: string, format: string): void {
    try {
      // Send analytics event
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'certificate_download', {
          certificate_id: certificateId,
          download_format: format,
          timestamp: new Date().toISOString()
        });
      }

      // Send to backend analytics
      fetch('/api/v1/analytics/certificate-download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          certificateId,
          format,
          timestamp: new Date().toISOString()
        })
      }).catch(error => console.warn('Analytics tracking failed:', error));
    } catch (error) {
      console.warn('Error tracking download:', error);
    }
  }

  /**
   * Bulk download multiple certificates
   */
  static async downloadMultipleCertificates(certificates: Certificate[]): Promise<void> {
    if (certificates.length === 0) return;

    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      for (const certificate of certificates) {
        const elementId = `certificate-${certificate.id}`;
        const element = document.getElementById(elementId);
        
        if (element) {
          const canvas = await html2canvas(element, {
            scale: 2,
            allowTaint: true,
            useCORS: true,
            backgroundColor: '#ffffff'
          });
          
          const imgData = canvas.toDataURL('image/png').split(',')[1];
          const fileName = `${certificate.courseTitle.replace(/\s+/g, '_')}_Certificate.png`;
          zip.file(fileName, imgData, { base64: true });
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `Certificates_${new Date().toISOString().split('T')[0]}.zip`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Error downloading multiple certificates:', error);
      throw new Error('Failed to download certificates. Please try again.');
    }
  }
}