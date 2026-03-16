'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { CertificateGenerationService, CertificateCheckResponse } from '@/services/certificate-generation.service';
import { CertificateErrorDisplay } from './CertificateErrorDisplay';
import { CertificateRequirementsDetail } from './CertificateRequirementsDetail';

interface CertificateGenerationModalProps {
  courseId: number;
  courseName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (certificate: any) => void;
  onError?: (error: string) => void;
}

export const CertificateGenerationModal: React.FC<CertificateGenerationModalProps> = ({
  courseId,
  courseName,
  isOpen,
  onClose,
  onSuccess,
  onError
}) => {
  const [step, setStep] = useState<'checking' | 'requirements' | 'generating' | 'success' | 'error'>('checking');
  const [isLoading, setIsLoading] = useState(false);
  const [checkResponse, setCheckResponse] = useState<CertificateCheckResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Check eligibility on mount
  useEffect(() => {
    if (isOpen && step === 'checking') {
      checkEligibility();
    }
  }, [isOpen, step]);

  const checkEligibility = async () => {
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      const response = await CertificateGenerationService.checkEligibility(courseId);
      setCheckResponse(response);

      if (response.eligible) {
        setStep('generating');
      } else if (response.success === false && response.error_code) {
        setStep('requirements');
      } else {
        setStep('requirements');
      }
    } catch (error: any) {
      const message = error?.message || 'Failed to check eligibility';
      setErrorMessage(message);
      setCheckResponse({
        success: false,
        eligible: false,
        message,
        error_code: 'CHECK_ERROR'
      });
      setStep('error');
    } finally {
      setIsLoading(false);
    }
  };

  const generateCertificate = async () => {
    setStep('generating');
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await CertificateGenerationService.generateCertificate(courseId);
      setCheckResponse(response);

      if (response.success && response.certificate) {
        setStep('success');
        onSuccess?.(response.certificate);
      } else {
        setErrorMessage(response.message || 'Certificate generation failed');
        setStep('error');
        onError?.(response.message || 'Failed to generate certificate');
      }
    } catch (error: any) {
      const message = error?.message || 'Failed to generate certificate';
      setErrorMessage(message);
      setStep('error');
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setStep('checking');
    checkEligibility();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Certificate Generation</DialogTitle>
          <DialogDescription className="text-base">{courseName}</DialogDescription>
        </DialogHeader>

        {/* Checking State */}
        {step === 'checking' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            <p className="text-lg font-medium">Checking eligibility...</p>
            <p className="text-sm text-gray-500">Verifying your course progress and requirements</p>
          </div>
        )}

        {/* Requirements Display */}
        {step === 'requirements' && checkResponse && !checkResponse.eligible && (
          <div className="space-y-6 py-6">
            <CertificateErrorDisplay
              requirements={checkResponse.requirements}
              failureReasons={checkResponse.failure_reasons}
              nextSteps={checkResponse.next_steps}
              errorMessage={checkResponse.message}
              summary={checkResponse.summary}
            />

            <div className="flex gap-2 pt-4 border-t">
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={handleRetry}
                disabled={isLoading}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {isLoading ? 'Checking...' : 'Refresh Status'}
              </Button>
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Continue Learning
              </Button>
            </div>
          </div>
        )}

        {/* Generating State */}
        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            <p className="text-lg font-medium">Generating certificate...</p>
            <p className="text-sm text-gray-500">Please wait while we create your certificate</p>
          </div>
        )}

        {/* Success State */}
        {step === 'success' && checkResponse && (
          <div className="space-y-6 py-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold text-green-900">Congratulations!</h3>
              <p className="text-gray-600">
                You have successfully completed {courseName} and earned your certificate!
              </p>
            </div>

            {checkResponse.certificate && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-blue-900">Certificate Details:</p>
                <div className="text-xs text-blue-800 space-y-1">
                  <div>Certificate #: {checkResponse.certificate.certificate_number}</div>
                  <div>Score: {checkResponse.certificate.overall_score || 'N/A'}%</div>
                  <div>Grade: {checkResponse.certificate.grade || 'A'}</div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button className="flex-1 bg-green-600 hover:bg-green-700">
                View Certificate
              </Button>
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}

        {/* Error State */}
        {step === 'error' && checkResponse && (
          <div className="space-y-6 py-6">
            <CertificateErrorDisplay
              requirements={checkResponse.requirements}
              failureReasons={checkResponse.failure_reasons}
              nextSteps={checkResponse.next_steps}
              errorMessage={errorMessage || checkResponse?.message}
              summary={checkResponse.summary}
            />

            <div className="flex gap-2 pt-4 border-t">
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={handleRetry}
                disabled={isLoading}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {isLoading ? 'Checking...' : 'Check Again'}
              </Button>
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
