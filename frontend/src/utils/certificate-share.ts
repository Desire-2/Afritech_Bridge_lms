import { Certificate } from './certificate-download';

export interface ShareOptions {
  platform: 'linkedin' | 'twitter' | 'facebook' | 'email' | 'copy' | 'whatsapp';
  message?: string;
  hashtags?: string[];
}

export class CertificateShareService {
  /**
   * Share certificate on various platforms
   */
  static shareCertificate(certificate: Certificate, options: ShareOptions): void {
    const shareUrl = this.generateShareableUrl(certificate);
    const message = options.message || this.getDefaultMessage(certificate);

    switch (options.platform) {
      case 'linkedin':
        this.shareOnLinkedIn(certificate, shareUrl, message);
        break;
      case 'twitter':
        this.shareOnTwitter(certificate, shareUrl, message, options.hashtags);
        break;
      case 'facebook':
        this.shareOnFacebook(shareUrl, message);
        break;
      case 'email':
        this.shareViaEmail(certificate, shareUrl, message);
        break;
      case 'whatsapp':
        this.shareOnWhatsApp(shareUrl, message);
        break;
      case 'copy':
        this.copyToClipboard(shareUrl, message);
        break;
      default:
        throw new Error(`Unsupported sharing platform: ${options.platform}`);
    }

    // Track sharing event
    this.trackShare(certificate.id, options.platform);
  }

  /**
   * Share on LinkedIn
   */
  private static shareOnLinkedIn(certificate: Certificate, url: string, message: string): void {
    const linkedInUrl = new URL('https://www.linkedin.com/sharing/share-offsite/');
    linkedInUrl.searchParams.set('url', url);
    linkedInUrl.searchParams.set('summary', message);
    linkedInUrl.searchParams.set('title', `Certificate - ${certificate.courseTitle}`);
    linkedInUrl.searchParams.set('source', 'AfriTech Bridge LMS');

    this.openShareWindow(linkedInUrl.toString(), 'linkedin');
  }

  /**
   * Share on Twitter
   */
  private static shareOnTwitter(certificate: Certificate, url: string, message: string, hashtags?: string[]): void {
    const twitterUrl = new URL('https://twitter.com/intent/tweet');
    const defaultHashtags = ['AfriTechBridge', 'OnlineLearning', 'Certificate', 'SkillDevelopment'];
    const allHashtags = [...defaultHashtags, ...(hashtags || [])];
    
    const tweetText = `${message} ${url} ${allHashtags.map(tag => `#${tag}`).join(' ')}`;
    
    if (tweetText.length > 280) {
      // Truncate message if too long
      const maxMessageLength = 280 - url.length - allHashtags.map(tag => `#${tag}`).join(' ').length - 2;
      const truncatedMessage = message.substring(0, maxMessageLength - 3) + '...';
      twitterUrl.searchParams.set('text', `${truncatedMessage} ${url}`);
    } else {
      twitterUrl.searchParams.set('text', tweetText);
    }

    this.openShareWindow(twitterUrl.toString(), 'twitter');
  }

  /**
   * Share on Facebook
   */
  private static shareOnFacebook(url: string, message: string): void {
    const facebookUrl = new URL('https://www.facebook.com/sharer/sharer.php');
    facebookUrl.searchParams.set('u', url);
    facebookUrl.searchParams.set('quote', message);

    this.openShareWindow(facebookUrl.toString(), 'facebook');
  }

  /**
   * Share via Email
   */
  private static shareViaEmail(certificate: Certificate, url: string, message: string): void {
    const subject = encodeURIComponent(`My Certificate - ${certificate.courseTitle}`);
    const body = encodeURIComponent(`${message}\n\nView and verify my certificate: ${url}\n\nBest regards`);
    
    const mailtoUrl = `mailto:?subject=${subject}&body=${body}`;
    window.location.href = mailtoUrl;
  }

  /**
   * Share on WhatsApp
   */
  private static shareOnWhatsApp(url: string, message: string): void {
    const whatsappText = encodeURIComponent(`${message}\n\nView certificate: ${url}`);
    const whatsappUrl = `https://wa.me/?text=${whatsappText}`;
    
    this.openShareWindow(whatsappUrl, 'whatsapp');
  }

  /**
   * Copy share link to clipboard
   */
  private static async copyToClipboard(url: string, message: string): Promise<void> {
    try {
      const shareText = `${message}\n\nView certificate: ${url}`;
      
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareText);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = shareText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }

      // Show success notification
      this.showCopySuccessNotification();
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      throw new Error('Failed to copy link. Please try again.');
    }
  }

  /**
   * Generate shareable URL
   */
  private static generateShareableUrl(certificate: Certificate): string {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/verify-certificate/${certificate.credentialId}?ref=share`;
  }

  /**
   * Get default share message
   */
  private static getDefaultMessage(certificate: Certificate): string {
    return `🎉 I just completed "${certificate.courseTitle}" and earned my certificate! 
    
Skills gained: ${certificate.skillsEarned.slice(0, 3).join(', ')}${certificate.skillsEarned.length > 3 ? ' and more' : ''}

Final Grade: ${certificate.finalGrade}%
Instructor: ${certificate.instructor}
Platform: AfriTech Bridge LMS`;
  }

  /**
   * Open share window
   */
  private static openShareWindow(url: string, platform: string): void {
    const width = 600;
    const height = 400;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    const windowFeatures = `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`;
    
    const shareWindow = window.open(url, `share-${platform}`, windowFeatures);
    
    if (!shareWindow) {
      // Fallback if popup is blocked
      window.location.href = url;
    }
  }

  /**
   * Show copy success notification
   */
  private static showCopySuccessNotification(): void {
    // Create temporary notification element
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg z-50 transition-opacity';
    notification.textContent = 'Link copied to clipboard!';
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  /**
   * Track sharing events for analytics
   */
  private static trackShare(certificateId: string, platform: string): void {
    try {
      // Send analytics event
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'certificate_share', {
          certificate_id: certificateId,
          share_platform: platform,
          timestamp: new Date().toISOString()
        });
      }

      // Send to backend analytics
      fetch('/api/v1/analytics/certificate-share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          certificateId,
          platform,
          timestamp: new Date().toISOString()
        })
      }).catch(error => console.warn('Analytics tracking failed:', error));
    } catch (error) {
      console.warn('Error tracking share:', error);
    }
  }

  /**
   * Get share statistics for a certificate
   */
  static async getShareStatistics(certificateId: string): Promise<{
    totalShares: number;
    sharesByPlatform: Record<string, number>;
    recentShares: Array<{ platform: string; timestamp: string }>;
  }> {
    try {
      const response = await fetch(`/api/v1/certificates/${certificateId}/share-stats`);
      const data = await response.json() as {
        totalShares: number;
        sharesByPlatform: Record<string, number>;
        recentShares: Array<{ platform: string; timestamp: string }>;
      };
      return data;
    } catch (error) {
      console.error('Error fetching share statistics:', error);
      return {
        totalShares: 0,
        sharesByPlatform: {},
        recentShares: []
      };
    }
  }

  /**
   * Generate custom share message
   */
  static generateCustomMessage(certificate: Certificate, template: 'professional' | 'casual' | 'achievement'): string {
    switch (template) {
      case 'professional':
        return `I'm pleased to announce that I have successfully completed "${certificate.courseTitle}" with a ${certificate.finalGrade}% grade. This certification validates my expertise in ${certificate.skillsEarned.join(', ')}. 

Grateful for the quality education provided by AfriTech Bridge LMS.`;

      case 'casual':
        return `Just finished "${certificate.courseTitle}" and I'm super excited! 🚀 

Learned so much about ${certificate.skillsEarned.slice(0, 2).join(' & ')} and scored ${certificate.finalGrade}%! 

Big thanks to ${certificate.instructor} for being an amazing instructor! 👏`;

      case 'achievement':
        return `🏆 ACHIEVEMENT UNLOCKED! 🏆

Successfully completed: ${certificate.courseTitle}
Final Score: ${certificate.finalGrade}%
Skills Mastered: ${certificate.skillsEarned.join(' • ')}

Another step forward in my learning journey with AfriTech Bridge LMS! 📚✨`;

      default:
        return this.getDefaultMessage(certificate);
    }
  }
}