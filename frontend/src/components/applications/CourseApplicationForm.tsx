'use client';

import React, { useState, useEffect } from 'react';
import applicationService from '@/services/api/application.service';
import { ApplicationSubmitData } from '@/services/api/types';
import { Course } from '@/services/api/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, Loader2, ChevronRight, ChevronLeft, AlertTriangle, User, Mail, Phone, Globe, GraduationCap, Briefcase, Monitor, Target, Clock, Award, Sparkles, TrendingUp, Shield, Zap, CreditCard } from 'lucide-react';

interface CourseApplicationFormProps {
  courseId: number;
  courseTitle?: string;
  courseData?: Course; // Full course data passed from parent
  onSuccess?: (applicationId: number) => void;
  onCancel?: () => void;
}

const EXCEL_TASKS = [
  { value: 'basic_formulas', label: 'Basic Formulas (SUM, AVERAGE, COUNT)' },
  { value: 'vlookup_hlookup', label: 'VLOOKUP / HLOOKUP' },
  { value: 'pivot_tables', label: 'Pivot Tables' },
  { value: 'charts_graphs', label: 'Charts and Graphs' },
  { value: 'conditional_formatting', label: 'Conditional Formatting' },
  { value: 'data_validation', label: 'Data Validation' },
  { value: 'macros_vba', label: 'Macros / VBA' },
  { value: 'power_query', label: 'Power Query' },
  { value: 'dashboard_creation', label: 'Dashboard Creation' },
];

const TIME_SLOTS = [
  { value: 'morning', label: 'Morning (6AM - 12PM)' },
  { value: 'afternoon', label: 'Afternoon (12PM - 6PM)' },
  { value: 'evening', label: 'Evening (6PM - 10PM)' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'any_time', label: 'Flexible / Any Time' },
];

export default function CourseApplicationForm({
  courseId,
  courseTitle,
  courseData,
  onSuccess,
  onCancel,
}: CourseApplicationFormProps) {
  const [currentSection, setCurrentSection] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [scores, setScores] = useState<any>(null);
  
  // Payment states
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'approved' | 'failed'>('pending');
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  
  // Duplicate check states
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [existingApplication, setExistingApplication] = useState<any>(null);
  const [emailChecked, setEmailChecked] = useState(false);

  const [formData, setFormData] = useState<ApplicationSubmitData>({
    course_id: courseId,
    full_name: '',
    email: '',
    phone: '',
    whatsapp_number: '',
    gender: undefined,
    age_range: undefined,
    country: '',
    city: '',
    education_level: undefined,
    current_status: undefined,
    field_of_study: '',
    has_used_excel: false,
    excel_skill_level: 'never_used',
    excel_tasks_done: [],
    motivation: '',
    learning_outcomes: '',
    career_impact: '',
    has_computer: false,
    internet_access_type: undefined,
    preferred_learning_mode: undefined,
    available_time: [],
    committed_to_complete: false,
    agrees_to_assessments: false,
    referral_source: '',
    payment_method: 'mobile_money',
    payment_phone_number: '',
    payment_payer_name: '',
    paypal_email: '',
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Check for duplicate application when email is entered
  const checkDuplicateApplication = async (email: string) => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return; // Don't check if email is invalid
    }

    setCheckingDuplicate(true);
    try {
      const result = await applicationService.checkDuplicate(courseId, email);
      setExistingApplication(result.exists ? result.application : null);
      setEmailChecked(true);
    } catch (err: any) {
      console.error('Error checking duplicate:', err);
    } finally {
      setCheckingDuplicate(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Email blur handler for immediate duplicate check
  const handleEmailBlur = () => {
    if (formData.email) {
      checkDuplicateApplication(formData.email);
    }
  };

  const handleCheckboxChange = (field: string, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [field]: checked }));
  };

  const handleMultiSelect = (field: string, value: string) => {
    setFormData((prev) => {
      const currentValues = (prev[field as keyof ApplicationSubmitData] as string[]) || [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value];
      return { ...prev, [field]: newValues };
    });
  };

  const validateSection = (section: number): boolean => {
    const errors: Record<string, string> = {};

    if (section === 1) {
      if (!formData.full_name.trim()) errors.full_name = 'Full name is required';
      if (!formData.email.trim()) errors.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.email = 'Invalid email format';
      }
      if (!formData.phone.trim()) errors.phone = 'Phone number is required';
      if (!formData.gender) errors.gender = 'Gender is required';
      if (!formData.age_range) errors.age_range = 'Age range is required';
      if (!formData.country?.trim()) errors.country = 'Country is required';
    }

    if (section === 2) {
      if (!formData.education_level) errors.education_level = 'Education level is required';
      if (!formData.current_status) errors.current_status = 'Current status is required';
    }

    if (section === 3) {
      if (formData.has_used_excel && !formData.excel_skill_level) {
        errors.excel_skill_level = 'Please select your Excel skill level';
      }
    }

    if (section === 4) {
      if (!formData.motivation.trim()) {
        errors.motivation = 'Please tell us why you want to join this course';
      } else if (formData.motivation.trim().length < 50) {
        errors.motivation = 'Please provide at least 50 characters (currently ' + formData.motivation.trim().length + ')';
      }
      if (!formData.learning_outcomes?.trim()) {
        errors.learning_outcomes = 'Please describe what you hope to achieve';
      }
    }

    if (section === 5) {
      if (formData.has_computer === undefined) {
        errors.has_computer = 'Please indicate if you have access to a computer';
      }
      if (!formData.internet_access_type) {
        errors.internet_access_type = 'Please indicate your internet access';
      }
      if (!formData.available_time || formData.available_time.length === 0) {
        errors.available_time = 'Please select at least one available time slot';
      }
    }

    if (section === 6) {
      if (!formData.committed_to_complete) {
        errors.committed_to_complete = 'You must commit to completing the course';
      }
      if (!formData.agrees_to_assessments) {
        errors.agrees_to_assessments = 'You must agree to participate in assessments';
      }
      if (courseData?.enrollment_type === 'paid') {
        if (formData.payment_method === 'mobile_money' && !formData.payment_phone_number?.trim()) {
          errors.payment_phone_number = 'Mobile money number is required for payment';
        }
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle payment initiation
  const handlePayNow = async () => {
    // Validate payment fields first
    if (!validateSection(6)) return;
    
    if (courseData?.enrollment_type !== 'paid') return;

    setPaymentLoading(true);
    setError(null);

    try {
      if (formData.payment_method === 'mobile_money') {
        // For mobile money, call the payment API
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/applications/initiate-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            course_id: courseId,
            amount: courseData.price,
            currency: courseData.currency || 'USD',
            phone_number: formData.payment_phone_number || formData.phone,
            payer_name: formData.payment_payer_name || formData.full_name,
            email: formData.email,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Payment initiation failed');
        }

        setPaymentReference(data.reference);
        setPaymentStatus('processing');
        
        // For mobile money, we show processing status and let user confirm after they approve on their phone
        setError(null);
      } else if (formData.payment_method === 'paypal') {
        // For PayPal, redirect to PayPal
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/applications/initiate-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            course_id: courseId,
            amount: courseData.price,
            currency: courseData.currency || 'USD',
            payment_method: 'paypal',
            email: formData.email,
            return_url: `${window.location.origin}/payment/success?course_id=${courseId}`,
            cancel_url: `${window.location.origin}/payment/cancel?course_id=${courseId}`,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'PayPal payment initiation failed');
        }

        if (data.approval_url) {
          // Store form data in localStorage for when user returns
          localStorage.setItem('pending_application_form', JSON.stringify({
            formData,
            courseId,
            courseTitle,
          }));
          // Redirect to PayPal
          window.location.href = data.approval_url;
          return;
        }
      }
    } catch (err: any) {
      setError(err.message || 'Payment initiation failed');
      setPaymentStatus('failed');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Handle payment confirmation (for mobile money after user approves on phone)
  const handleConfirmPayment = async () => {
    if (!paymentReference) return;

    setPaymentLoading(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/applications/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reference: paymentReference,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment verification failed');
      }

      if (data.status === 'completed' || data.status === 'successful') {
        setPaymentStatus('approved');
        setError(null);
      } else if (data.status === 'pending') {
        setError('Payment is still processing. Please wait and try again.');
      } else {
        throw new Error('Payment was not successful. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Payment verification failed');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleNext = () => {
    // Don't allow proceeding if email already exists
    if (currentSection === 1 && existingApplication) {
      return;
    }
    
    if (validateSection(currentSection)) {
      setCurrentSection((prev) => Math.min(prev + 1, 6));
      setError(null); // Clear any errors when moving to next section
    }
  };

  const handlePrevious = () => {
    setCurrentSection((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Final check for duplicate before submission
    if (existingApplication) {
      setError('You have already applied for this course. Please check your email for application status.');
      return;
    }
    
    // For paid courses, ensure payment is approved first
    if (courseData?.enrollment_type === 'paid' && paymentStatus !== 'approved') {
      setError('Please complete payment before submitting your application.');
      return;
    }
    
    if (!validateSection(6)) return;

    setLoading(true);
    setError(null);

    try {
      const payload: ApplicationSubmitData = {
        ...formData,
        payment_method: courseData?.enrollment_type === 'paid' ? formData.payment_method : undefined,
        payment_phone_number: courseData?.enrollment_type === 'paid' && formData.payment_method === 'mobile_money'
          ? (formData.payment_phone_number || formData.phone)
          : undefined,
        payment_payer_name: courseData?.enrollment_type === 'paid' && formData.payment_method === 'mobile_money'
          ? (formData.payment_payer_name || formData.full_name)
          : undefined,
        paypal_email: courseData?.enrollment_type === 'paid' && formData.payment_method === 'paypal'
          ? formData.email
          : undefined,
      };

      // Add payment reference if payment was completed
      if (courseData?.enrollment_type === 'paid' && paymentReference) {
        (payload as any).payment_reference = paymentReference;
        (payload as any).payment_status = 'completed';
      }

      if (courseData?.enrollment_type !== 'paid') {
        delete payload.payment_method;
        delete payload.payment_phone_number;
        delete payload.payment_payer_name;
        delete payload.paypal_email;
      }

      const response = await applicationService.submitApplication(payload);
      
      if (response && response.application_id) {
        // Payment already completed before submission, no need to redirect
        setSuccess(true);
        setApplicationId(response.application_id);
        setScores(response.scores);
        
        if (onSuccess) {
          onSuccess(response.application_id);
        }
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to submit application';
      setError(errorMsg);
      
      // If it's a duplicate error (409), scroll to top to show the error
      if (err.response?.status === 409) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-2xl border border-gray-200 bg-white overflow-hidden">
          <CardContent className="pt-12 pb-8">
            <div className="text-center space-y-8">
              {/* Animated Success Icon */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-200 rounded-full blur-xl animate-pulse opacity-50"></div>
                  <div className="relative p-6 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full shadow-lg transform hover:scale-110 transition-transform duration-300">
                    <CheckCircle2 className="w-20 h-20 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2">
                    <Sparkles className="w-8 h-8 text-amber-500 animate-bounce" />
                  </div>
                </div>
              </div>
              
              {/* Success Message */}
              <div className="space-y-3">
                <h2 className="text-4xl font-bold text-gray-900">
                  Application Submitted Successfully!
                </h2>
                <p className="text-gray-700 text-xl max-w-2xl mx-auto">
                  Thank you for applying to{' '}
                  <span className="font-bold text-emerald-600">
                    {courseTitle || 'the course'}
                  </span>
                </p>
              </div>
            
            {applicationId && (
              <div className="relative">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 p-8 rounded-2xl shadow-md">
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <Shield className="w-6 h-6 text-emerald-600" />
                    <strong className="text-lg text-gray-900">Application ID</strong>
                  </div>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <span className="text-4xl font-mono font-bold text-emerald-600">
                      #{applicationId}
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-700">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Save this ID to track your application status</span>
                  </div>
                </div>
              </div>
            )}

            {scores && (
              <div className="space-y-6">
                <div className="flex items-center justify-center gap-2">
                  <TrendingUp className="w-6 h-6 text-gray-700" />
                  <h3 className="text-2xl font-bold text-gray-900">Your Application Scores</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Application Score */}
                  <div className="relative">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 p-6 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm text-gray-800 font-bold uppercase tracking-wide">Application Score</p>
                        <Target className="w-5 h-5 text-blue-600" />
                      </div>
                      <p className="text-5xl font-bold text-blue-600">{scores.application_score}<span className="text-2xl text-gray-600">/100</span></p>
                      <div className="mt-3 h-2.5 bg-blue-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full" style={{ width: `${scores.application_score}%` }}></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Readiness Score */}
                  <div className="relative">
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-300 p-6 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm text-gray-800 font-bold uppercase tracking-wide">Readiness Score</p>
                        <Zap className="w-5 h-5 text-emerald-600" />
                      </div>
                      <p className="text-5xl font-bold text-emerald-600">{scores.readiness_score}<span className="text-2xl text-gray-600">/100</span></p>
                      <div className="mt-3 h-2.5 bg-emerald-200 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${scores.readiness_score}%` }}></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Commitment Score */}
                  <div className="relative">
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 p-6 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm text-gray-800 font-bold uppercase tracking-wide">Commitment Score</p>
                        <Award className="w-5 h-5 text-purple-600" />
                      </div>
                      <p className="text-5xl font-bold text-purple-600">{scores.commitment_score}<span className="text-2xl text-gray-600">/100</span></p>
                      <div className="mt-3 h-2.5 bg-purple-200 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-600 rounded-full" style={{ width: `${scores.commitment_score}%` }}></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Final Rank */}
                  <div className="relative">
                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-300 p-6 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm text-gray-800 font-bold uppercase tracking-wide">Final Rank</p>
                        <Sparkles className="w-5 h-5 text-amber-600" />
                      </div>
                      <p className="text-5xl font-bold text-amber-600">{scores.final_rank}<span className="text-2xl text-gray-600">/100</span></p>
                      <div className="mt-3 h-2.5 bg-amber-200 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-600 rounded-full" style={{ width: `${scores.final_rank}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="relative">
              <div className="bg-gray-50 border-2 border-gray-300 p-8 rounded-2xl shadow-sm text-left">
                <h4 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  </div>
                  What Happens Next?
                </h4>
                <ul className="space-y-4 text-base text-gray-800">
                  <li className="flex items-start gap-4 group">
                    <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                      <Mail className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span>Confirmation email sent to <strong className="text-emerald-700">{formData.email}</strong></span>
                  </li>
                  <li className="flex items-start gap-4 group">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                      <Clock className="w-4 h-4 text-blue-600" />
                    </div>
                    <span>Our team will review your application within <strong className="text-blue-700">2-3 business days</strong></span>
                  </li>
                  <li className="flex items-start gap-4 group">
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                    </div>
                    <span>You'll receive an email notification once your application is processed</span>
                  </li>
                  <li className="flex items-start gap-4 group">
                    <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                    </div>
                    <span>Check your spam folder if you don't see our email</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => window.location.href = '/courses'}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-6 text-lg font-semibold shadow-md hover:shadow-lg transition-all duration-300 rounded-xl"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Browse More Courses
              </Button>
              {onCancel && (
                <Button
                  variant="outline"
                  onClick={onCancel}
                  className="px-10 py-6 text-lg border-2 border-gray-300 hover:bg-gray-50 rounded-xl transition-all duration-300"
                >
                  <ChevronLeft className="w-5 h-5 mr-2" />
                  Go Back
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    );
  }

  const renderSection = () => {
    switch (currentSection) {
      case 1:
        return renderApplicantInfo();
      case 2:
        return renderEducationBackground();
      case 3:
        return renderExcelSkills();
      case 4:
        return renderLearningGoals();
      case 5:
        return renderAccessAvailability();
      case 6:
        return renderCommitment();
      default:
        return null;
    }
  };

  const renderApplicantInfo = () => (
    <div className="space-y-6">
      {/* Duplicate Application Warning */}
      {existingApplication && (
        <Alert className="border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 shadow-lg rounded-xl">
          <AlertTriangle className="h-6 w-6 text-amber-600" />
          <AlertDescription className="ml-2">
            <div className="space-y-3">
              <p className="font-bold text-amber-900 dark:text-amber-200 text-lg">
                You have already applied for this course!
              </p>
              <div className="text-sm text-amber-800 dark:text-amber-300 space-y-2 bg-white/50 p-4 rounded-lg">
                <p className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  <strong>Application ID:</strong> #{existingApplication.id}
                </p>
                <p className="flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  <strong>Status:</strong> <span className="capitalize font-semibold">{existingApplication.status}</span>
                </p>
                {existingApplication.submitted_at && (
                  <p className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <strong>Submitted:</strong> {new Date(existingApplication.submitted_at).toLocaleDateString()}
                  </p>
                )}
                {existingApplication.final_rank && (
                  <p className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    <strong>Final Rank:</strong> {existingApplication.final_rank}/100
                  </p>
                )}
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-400 pt-2 bg-white/50 p-3 rounded-lg">
                Please check your email ({formData.email}) for updates on your application status.
                You cannot submit multiple applications for the same course.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Email checking indicator */}
      {checkingDuplicate && (
        <div className="flex items-center gap-3 text-base text-blue-700 bg-gradient-to-r from-blue-50 to-sky-50 border-2 border-blue-200 p-4 rounded-xl shadow-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="font-semibold">Checking if you've already applied...</span>
        </div>
      )}

      {/* Full Name Input */}
      <div className="relative group">
        <Label htmlFor="full_name" className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
          <User className="w-5 h-5 text-emerald-600" />
          Full Name <span className="text-red-600">*</span>
        </Label>
        <Input
          id="full_name"
          value={formData.full_name}
          onChange={(e) => handleInputChange('full_name', e.target.value)}
          placeholder="Enter your full legal name"
          className={`py-6 text-base text-gray-900 placeholder:text-gray-500 rounded-xl transition-all duration-300 ${
            validationErrors.full_name 
              ? 'border-red-500 bg-red-50/50 focus-visible:border-red-600 focus-visible:ring-red-200' 
              : 'border-gray-300 bg-white focus-visible:border-emerald-500 focus-visible:ring-emerald-200'
          }`}
        />
        <p className="text-sm text-gray-600 mt-2 ml-1 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Please ensure this matches your official identification.
        </p>
        {validationErrors.full_name && (
          <p className="text-sm text-red-600 mt-2 font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {validationErrors.full_name}
          </p>
        )}
      </div>

      {/* Email Input */}
      <div className="relative group">
        <Label htmlFor="email" className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
          <Mail className="w-5 h-5 text-emerald-600" />
          Email Address <span className="text-red-600">*</span>
        </Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          onBlur={handleEmailBlur}
          placeholder="your.email@example.com"
          disabled={checkingDuplicate}
          className={`py-6 text-base text-gray-900 placeholder:text-gray-500 rounded-xl transition-all duration-300 ${
            validationErrors.email 
              ? 'border-red-500 bg-red-50/50 focus-visible:border-red-600 focus-visible:ring-red-200' 
              : 'border-gray-300 bg-white focus-visible:border-emerald-500 focus-visible:ring-emerald-200'
          } ${checkingDuplicate ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        <p className="text-sm text-gray-700 mt-2 ml-1 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          We will use this for all official communication and check for duplicate applications.
        </p>
        {validationErrors.email && (
          <p className="text-sm text-red-600 mt-2 font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {validationErrors.email}
          </p>
        )}
      </div>

      {/* Phone Input */}
      <div className="relative group">
        <Label htmlFor="phone" className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
          <Phone className="w-5 h-5 text-emerald-600" />
          Phone Number <span className="text-red-600">*</span>
        </Label>
        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => handleInputChange('phone', e.target.value)}
          placeholder="+234-801-234-5678"
          className={`py-6 text-base text-gray-900 placeholder:text-gray-500 rounded-xl transition-all duration-300 ${
            validationErrors.phone 
              ? 'border-red-500 bg-red-50/50 focus-visible:border-red-600 focus-visible:ring-red-200' 
              : 'border-gray-300 bg-white focus-visible:border-emerald-500 focus-visible:ring-emerald-200'
          }`}
        />
        <p className="text-sm text-gray-700 mt-2 ml-1">
          Include country code (e.g., +234).
        </p>
        {validationErrors.phone && (
          <p className="text-sm text-red-600 mt-2 font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {validationErrors.phone}
          </p>
        )}
      </div>

      {/* WhatsApp Input */}
      <div className="relative group">
        <Label htmlFor="whatsapp" className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
          <Phone className="w-5 h-5 text-green-600" />
          WhatsApp Contact Number
        </Label>
        <Input
          id="whatsapp"
          value={formData.whatsapp_number}
          onChange={(e) => handleInputChange('whatsapp_number', e.target.value)}
          placeholder="Same as phone or different"
          className="py-6 text-base text-gray-900 placeholder:text-gray-500 bg-white rounded-xl focus-visible:border-green-500 focus-visible:ring-green-200 transition-all duration-300"
        />
        <p className="text-sm text-gray-700 mt-2 ml-1">
          We may use WhatsApp for quick updates.
        </p>
      </div>

      {/* Gender and Age in Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gender Select */}
        <div>
          <Label htmlFor="gender" className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
            <User className="w-5 h-5 text-purple-600" />
            Gender
          </Label>
          <Select
            value={formData.gender}
            onValueChange={(value) => handleInputChange('gender', value)}
          >
            <SelectTrigger className="py-6 text-base border-2 border-gray-300 rounded-xl focus:border-purple-600 focus:ring-2 focus:ring-purple-200 text-gray-900">
              <SelectValue placeholder="Please select your gender" className="text-gray-900" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
              <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Age Range Select */}
        <div>
          <Label htmlFor="age_range" className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Age Range
          </Label>
          <Select
            value={formData.age_range}
            onValueChange={(value) => handleInputChange('age_range', value)}
          >
            <SelectTrigger className="py-6 text-base border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:ring-2 focus:ring-blue-200 text-gray-900">
              <SelectValue placeholder="Your age group" className="text-gray-900" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="under_18">Under 18</SelectItem>
              <SelectItem value="18_24">18-24</SelectItem>
              <SelectItem value="25_34">25-34</SelectItem>
              <SelectItem value="35_44">35-44</SelectItem>
              <SelectItem value="45_54">45-54</SelectItem>
              <SelectItem value="55_plus">55+</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-gray-600 mt-2 ml-1">
            This helps us tailor content to different learning styles.
          </p>
        </div>
      </div>

      {/* Country and City */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="country" className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
            <Globe className="w-5 h-5 text-emerald-600" />
            Country
          </Label>
          <Input
            id="country"
            value={formData.country}
            onChange={(e) => handleInputChange('country', e.target.value)}
            placeholder="Which country are you applying from?"
            className="py-6 text-base text-gray-900 placeholder:text-gray-500 bg-white rounded-xl focus-visible:border-emerald-500 focus-visible:ring-emerald-200 transition-all duration-300"
          />
          <p className="text-sm text-gray-700 mt-2 ml-1">
            We prioritize applicants from African countries.
          </p>
        </div>

        <div>
          <Label htmlFor="city" className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
            <Globe className="w-5 h-5 text-teal-600" />
            City / District
          </Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => handleInputChange('city', e.target.value)}
            placeholder="Your current city or district"
            className="py-6 text-base text-gray-900 placeholder:text-gray-500 bg-white rounded-xl focus-visible:border-teal-500 focus-visible:ring-teal-200 transition-all duration-300"
          />
        </div>
      </div>
    </div>
  );

  const renderEducationBackground = () => (
    <div className="space-y-6">
      <div>
        <Label htmlFor="education_level" className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
          <GraduationCap className="w-5 h-5 text-indigo-600" />
          Highest Level of Education
        </Label>
        <Select
          value={formData.education_level}
          onValueChange={(value) => handleInputChange('education_level', value)}
        >
          <SelectTrigger className="py-6 text-base border-2 border-gray-300 rounded-xl focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 text-gray-900">
            <SelectValue placeholder="What is your highest academic qualification?" className="text-gray-900" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="high_school">High School</SelectItem>
            <SelectItem value="diploma">Diploma</SelectItem>
            <SelectItem value="bachelors">Bachelor's Degree</SelectItem>
            <SelectItem value="masters">Master's Degree</SelectItem>
            <SelectItem value="phd">PhD</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="current_status" className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
          <Briefcase className="w-5 h-5 text-blue-600" />
          Current Status
        </Label>
        <Select
          value={formData.current_status}
          onValueChange={(value) => handleInputChange('current_status', value)}
        >
          <SelectTrigger className="py-6 text-base border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:ring-2 focus:ring-blue-200 text-gray-900">
            <SelectValue placeholder="What is your current professional status?" className="text-gray-900" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="student">Student</SelectItem>
            <SelectItem value="employed">Employed (Full-time/Part-time)</SelectItem>
            <SelectItem value="self_employed">Self-Employed / Business Owner</SelectItem>
            <SelectItem value="freelancer">Freelancer</SelectItem>
            <SelectItem value="unemployed">Unemployed</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="field_of_study" className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
          <Target className="w-5 h-5 text-purple-600" />
          Field of Study / Profession
        </Label>
        <Input
          id="field_of_study"
          value={formData.field_of_study}
          onChange={(e) => handleInputChange('field_of_study', e.target.value)}
          placeholder="E.g., Finance, Marketing, Engineering, Student"
          className="py-6 text-base border-2 border-gray-300 rounded-xl focus:border-purple-600 focus:ring-2 focus:ring-purple-200 transition-all duration-300"
        />
        <p className="text-sm text-gray-700 mt-2 ml-1">
          What is your main field of study or profession?
        </p>
      </div>
    </div>
  );

  const renderExcelSkills = () => (
    <div className="space-y-6">
      <div className="bg-emerald-50 border-l-4 border-emerald-600 p-6 rounded-r-xl">
        <Label className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Monitor className="w-6 h-6 text-emerald-600" />
          Have you used Microsoft Excel before?
        </Label>
        <div className="flex items-center space-x-6 mt-3">
          <label className="flex items-center space-x-3 cursor-pointer group">
            <input
              type="radio"
              name="has_used_excel"
              checked={formData.has_used_excel === true}
              onChange={() => handleInputChange('has_used_excel', true)}
              className="w-5 h-5 text-emerald-600 border-2 border-gray-300 focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-base font-semibold text-gray-700 group-hover:text-emerald-600 transition-colors">Yes</span>
          </label>
          <label className="flex items-center space-x-3 cursor-pointer group">
            <input
              type="radio"
              name="has_used_excel"
              checked={formData.has_used_excel === false}
              onChange={() => handleInputChange('has_used_excel', false)}
              className="w-5 h-5 text-gray-600 border-2 border-gray-300 focus:ring-2 focus:ring-gray-500"
            />
            <span className="text-base font-semibold text-gray-700 group-hover:text-gray-600 transition-colors">No</span>
          </label>
        </div>
      </div>

      <div>
        <Label htmlFor="excel_skill_level" className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          Your Excel Skill Level
        </Label>
        <Select
          value={formData.excel_skill_level}
          onValueChange={(value) => handleInputChange('excel_skill_level', value)}
        >
          <SelectTrigger className="py-6 text-base border-2 border-gray-300 rounded-xl focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 text-gray-900">
            <SelectValue placeholder="How would you rate your current Excel skill level?" className="text-gray-900" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="never_used">Never Used Excel</SelectItem>
            <SelectItem value="beginner">Beginner (Basic navigation)</SelectItem>
            <SelectItem value="intermediate">Intermediate (Formulas, charts)</SelectItem>
            <SelectItem value="advanced">Advanced (Pivot tables, VLOOKUP)</SelectItem>
            <SelectItem value="expert">Expert (Macros, Power Query)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-gray-600 mt-2 ml-1 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          Be honest! This helps us place you in the right group.
        </p>
      </div>

      {formData.has_used_excel && (
        <div className="bg-blue-50 border-2 border-blue-300 p-6 rounded-2xl">
          <Label className="text-base font-bold text-gray-900 flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
            Which Excel tasks have you done before?
          </Label>
          <p className="text-sm text-gray-700 mb-4">Select all that apply</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {EXCEL_TASKS.map((task) => (
              <label 
                key={task.value} 
                className="flex items-start space-x-3 p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 cursor-pointer group"
              >
                <Checkbox
                  checked={(formData.excel_tasks_done || []).includes(task.value)}
                  onCheckedChange={() => handleMultiSelect('excel_tasks_done', task.value)}
                  className="mt-0.5 w-5 h-5"
                />
                <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700 transition-colors">{task.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderLearningGoals = () => (
    <div className="space-y-6">
      <div>
        <Label htmlFor="motivation" className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
          <Target className="w-5 h-5 text-rose-600" />
          Why do you want to join this course? <span className="text-red-600">*</span>
        </Label>
        <Textarea
          id="motivation"
          value={formData.motivation}
          onChange={(e) => handleInputChange('motivation', e.target.value)}
          placeholder="Tell us what sparked your interest in Excel Mastery... Share your story, your challenges, and what drives you to learn this skill."
          rows={5}
          className={`text-base text-gray-900 placeholder:text-gray-500 rounded-xl transition-all duration-300 resize-none ${
            validationErrors.motivation 
              ? 'border-red-500 bg-red-50/50 focus-visible:border-red-600 focus-visible:ring-red-200' 
              : formData.motivation.length >= 50
              ? 'border-emerald-500 bg-emerald-50/30 focus-visible:border-emerald-600 focus-visible:ring-emerald-300'
              : 'border-gray-300 bg-white focus-visible:border-rose-500 focus-visible:ring-rose-200'
          }`}
        />
        <div className="flex justify-between items-center mt-2">
          <p className="text-sm text-gray-700 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Your motivation for taking this course (minimum 50 characters)
          </p>
          <p className={`text-sm font-semibold px-3 py-1 rounded-full ${
            formData.motivation.length >= 50 
              ? 'bg-emerald-100 text-emerald-700' 
              : formData.motivation.length >= 30
              ? 'bg-amber-100 text-amber-700'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {formData.motivation.length} / 50 characters
          </p>
        </div>
        {validationErrors.motivation && (
          <p className="text-sm text-red-600 mt-2 font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {validationErrors.motivation}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="learning_outcomes" className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
          <Award className="w-5 h-5 text-amber-600" />
          What do you want to achieve after completing this course?
        </Label>
        <Textarea
          id="learning_outcomes"
          value={formData.learning_outcomes}
          onChange={(e) => handleInputChange('learning_outcomes', e.target.value)}
          placeholder="E.g., Get a promotion, start a data analytics business, pass Excel certification, build financial models..."
          rows={4}
          className="text-base text-gray-900 placeholder:text-gray-500 bg-white rounded-xl focus-visible:border-amber-500 focus-visible:ring-amber-200 transition-all duration-300 resize-none"
        />
        <p className="text-sm text-gray-700 mt-2 ml-1">
          Your specific learning outcomes and goals
        </p>
      </div>

      <div>
        <Label htmlFor="career_impact" className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          How will Excel skills help your career or business?
        </Label>
        <Textarea
          id="career_impact"
          value={formData.career_impact}
          onChange={(e) => handleInputChange('career_impact', e.target.value)}
          placeholder="Think about the real-world impact... Will it help you analyze data better? Make reports? Automate tasks? Scale your business?"
          rows={4}
          className="text-base text-gray-900 placeholder:text-gray-500 bg-white rounded-xl focus-visible:border-blue-500 focus-visible:ring-blue-200 transition-all duration-300 resize-none"
        />
        <p className="text-sm text-gray-700 mt-2 ml-1">
          Connect Excel to your professional growth
        </p>
      </div>
    </div>
  );

  const renderAccessAvailability = () => (
    <div className="space-y-6">
      <div className="bg-purple-50 border-l-4 border-purple-600 p-6 rounded-r-xl">
        <Label className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Monitor className="w-6 h-6 text-purple-600" />
          Do you have access to a computer or laptop?
        </Label>
        <div className="flex items-center space-x-6 mt-3">
          <label className="flex items-center space-x-3 cursor-pointer group">
            <input
              type="radio"
              name="has_computer"
              checked={formData.has_computer === true}
              onChange={() => handleInputChange('has_computer', true)}
              className="w-5 h-5 text-purple-600 border-2 border-gray-300 focus:ring-2 focus:ring-purple-500"
            />
            <span className="text-base font-semibold text-gray-700 group-hover:text-purple-600 transition-colors">Yes</span>
          </label>
          <label className="flex items-center space-x-3 cursor-pointer group">
            <input
              type="radio"
              name="has_computer"
              checked={formData.has_computer === false}
              onChange={() => handleInputChange('has_computer', false)}
              className="w-5 h-5 text-gray-600 border-2 border-gray-300 focus:ring-2 focus:ring-gray-500"
            />
            <span className="text-base font-semibold text-gray-700 group-hover:text-gray-600 transition-colors">No</span>
          </label>
        </div>
        <p className="text-sm text-gray-600 mt-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          A personal device is highly recommended for practice.
        </p>
      </div>

      <div>
        <Label htmlFor="internet_access_type" className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
          <Globe className="w-5 h-5 text-cyan-600" />
          Internet Access Type
        </Label>
        <Select
          value={formData.internet_access_type}
          onValueChange={(value) => handleInputChange('internet_access_type', value)}
        >
          <SelectTrigger className="py-6 text-base border-2 border-gray-300 rounded-xl focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200 text-gray-900">
            <SelectValue placeholder="How do you primarily access the internet?" className="text-gray-900" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="stable_broadband">Stable Broadband / WiFi</SelectItem>
            <SelectItem value="mobile_data">Mobile Data</SelectItem>
            <SelectItem value="limited_access">Limited Access</SelectItem>
            <SelectItem value="public_wifi">Public WiFi / Cafe</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-gray-600 mt-2 ml-1">
          This helps us plan for data usage and connectivity challenges.
        </p>
      </div>

      <div>
        <Label htmlFor="preferred_learning_mode" className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
          <Target className="w-5 h-5 text-indigo-600" />
          Preferred Learning Mode
        </Label>
        <Select
          value={formData.preferred_learning_mode}
          onValueChange={(value) => handleInputChange('preferred_learning_mode', value)}
        >
          <SelectTrigger className="py-6 text-base border-2 border-gray-300 rounded-xl focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 text-gray-900">
            <SelectValue placeholder="How do you prefer to learn?" className="text-gray-900" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="self_paced">Self-Paced (Learn at my own speed)</SelectItem>
            <SelectItem value="live_sessions">Live Sessions (Interactive classes)</SelectItem>
            <SelectItem value="hybrid">Hybrid (Mix of both)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-blue-50 border-2 border-blue-300 p-6 rounded-2xl">
        <Label className="text-base font-bold text-gray-900 flex items-center gap-2 mb-3">
          <Clock className="w-6 h-6 text-blue-600" />
          Available Time for Learning
        </Label>
        <p className="text-sm text-gray-700 mb-4">
          When are you most available to dedicate time to the course? (Select all that work for you)
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TIME_SLOTS.map((slot) => (
            <label 
              key={slot.value} 
              className="flex items-start space-x-3 p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-sky-400 hover:bg-sky-50 transition-all duration-200 cursor-pointer group"
            >
              <Checkbox
                checked={(formData.available_time || []).includes(slot.value)}
                onCheckedChange={() => handleMultiSelect('available_time', slot.value)}
                className="mt-0.5 w-5 h-5"
              />
              <span className="text-sm font-medium text-gray-700 group-hover:text-sky-700 transition-colors">{slot.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderCommitment = () => (
    <div className="space-y-8">
      <Alert className="border-2 border-blue-400 bg-blue-50 shadow-sm">
        <AlertCircle className="h-6 w-6 text-blue-600" />
        <AlertDescription className="ml-2">
          <p className="font-bold text-gray-900 text-base">
            Please review and confirm your commitment to the course requirements.
          </p>
        </AlertDescription>
      </Alert>

      <div className="space-y-6">
        {/* Commitment Checkbox */}
        <div className={`relative transition-all duration-300 ${
          formData.committed_to_complete 
            ? 'bg-emerald-50 border-2 border-emerald-500' 
            : validationErrors.committed_to_complete
            ? 'bg-red-50 border-2 border-red-400'
            : 'bg-white border-2 border-gray-300 hover:border-emerald-400'
        } p-6 rounded-2xl shadow-sm hover:shadow-md`}>
          <div className="flex items-start space-x-4">
            <Checkbox
              id="committed"
              checked={formData.committed_to_complete}
              onCheckedChange={(checked) => handleCheckboxChange('committed_to_complete', checked as boolean)}
              className="mt-1 w-6 h-6"
            />
            <div className="flex-1">
              <Label htmlFor="committed" className="text-base font-bold cursor-pointer text-gray-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-600" />
                Are you committed to completing the full course?
              </Label>
              <p className="text-sm text-gray-700 mt-2 leading-relaxed">
                We are looking for dedicated learners! Your commitment is key to your success. This course requires consistent effort and active participation.
              </p>
              {validationErrors.committed_to_complete && (
                <p className="text-sm text-red-600 mt-3 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {validationErrors.committed_to_complete}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Assessment Agreement Checkbox */}
        <div className={`relative transition-all duration-300 ${
          formData.agrees_to_assessments 
            ? 'bg-purple-50 border-2 border-purple-500' 
            : validationErrors.agrees_to_assessments
            ? 'bg-red-50 border-2 border-red-400'
            : 'bg-white border-2 border-gray-300 hover:border-purple-400'
        } p-6 rounded-2xl shadow-sm hover:shadow-md`}>
          <div className="flex items-start space-x-4">
            <Checkbox
              id="assessments"
              checked={formData.agrees_to_assessments}
              onCheckedChange={(checked) => handleCheckboxChange('agrees_to_assessments', checked as boolean)}
              className="mt-1 w-6 h-6"
            />
            <div className="flex-1">
              <Label htmlFor="assessments" className="text-base font-bold cursor-pointer text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-purple-600" />
                Do you agree to attend assessments and practical projects?
              </Label>
              <p className="text-sm text-gray-700 mt-2 leading-relaxed">
                I agree to participate fully in all required course activities including quizzes, assignments, and practical projects to demonstrate my learning.
              </p>
              {validationErrors.agrees_to_assessments && (
                <p className="text-sm text-red-600 mt-3 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {validationErrors.agrees_to_assessments}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Referral Source */}
      <div>
        <Label htmlFor="referral_source" className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-amber-600" />
          How did you hear about this course?
        </Label>
        <Input
          id="referral_source"
          value={formData.referral_source}
          onChange={(e) => handleInputChange('referral_source', e.target.value)}
          placeholder="E.g., Facebook, Friend referral, Google search, WhatsApp group..."
          className="py-6 text-base border-2 border-gray-300 rounded-xl focus:border-amber-600 focus:ring-2 focus:ring-amber-200 transition-all duration-300"
        />
        <p className="text-sm text-gray-700 mt-2 ml-1">
          Please let us know how you found us - this helps us reach more learners!
        </p>
      </div>

      {courseData?.enrollment_type === 'paid' && (
        <div className="bg-indigo-50 border-2 border-indigo-300 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">Payment Details</p>
              <p className="text-sm text-gray-700">
                Course fee: {courseData.currency || 'USD'} {courseData.price}
              </p>
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="mb-6">
            <Label className="text-base font-bold text-gray-900 mb-3 block">
              Select Payment Method
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* MTN Mobile Money Option */}
              <div
                onClick={() => handleInputChange('payment_method', 'mobile_money')}
                className={`cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 ${
                  formData.payment_method === 'mobile_money'
                    ? 'border-indigo-600 bg-indigo-100 shadow-md'
                    : 'border-gray-300 bg-white hover:border-indigo-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${formData.payment_method === 'mobile_money' ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                    <Phone className={`w-5 h-5 ${formData.payment_method === 'mobile_money' ? 'text-white' : 'text-gray-600'}`} />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">MTN Mobile Money</p>
                    <p className="text-xs text-gray-600">Pay with your mobile wallet</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Available in: Ghana, Nigeria, Cameroon, Rwanda, Uganda, Côte d&apos;Ivoire, Benin, Zambia, South Africa, and more
                </p>
              </div>

              {/* PayPal Option */}
              <div
                onClick={() => handleInputChange('payment_method', 'paypal')}
                className={`cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 ${
                  formData.payment_method === 'paypal'
                    ? 'border-blue-600 bg-blue-100 shadow-md'
                    : 'border-gray-300 bg-white hover:border-blue-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${formData.payment_method === 'paypal' ? 'bg-blue-600' : 'bg-gray-200'}`}>
                    <CreditCard className={`w-5 h-5 ${formData.payment_method === 'paypal' ? 'text-white' : 'text-gray-600'}`} />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">PayPal</p>
                    <p className="text-xs text-gray-600">Pay with PayPal or card</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Available worldwide - Pay securely with PayPal, credit or debit card
                </p>
              </div>
            </div>
          </div>

          {/* Mobile Money Fields */}
          {formData.payment_method === 'mobile_money' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
              <div className="space-y-2">
                <Label htmlFor="payment_payer_name" className="text-base font-bold text-gray-900">
                  Payer Name (optional)
                </Label>
                <Input
                  id="payment_payer_name"
                  value={formData.payment_payer_name}
                  onChange={(e) => handleInputChange('payment_payer_name', e.target.value)}
                  placeholder="Enter name for payment"
                  className="py-6 text-base border-2 border-gray-300 rounded-xl focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_phone_number" className="text-base font-bold text-gray-900">
                  Mobile Money Number
                </Label>
                <Input
                  id="payment_phone_number"
                  value={formData.payment_phone_number}
                  onChange={(e) => handleInputChange('payment_phone_number', e.target.value)}
                  placeholder="e.g. +256700000000"
                  className={`py-6 text-base border-2 rounded-xl focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 ${
                    validationErrors.payment_phone_number ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
                {validationErrors.payment_phone_number && (
                  <p className="text-sm text-red-600 mt-1 font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {validationErrors.payment_phone_number}
                  </p>
                )}
                <p className="text-xs text-gray-600">We will send a payment prompt to this number.</p>
              </div>
            </div>
          )}

          {/* PayPal Info */}
          {formData.payment_method === 'paypal' && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl animate-in fade-in duration-300">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">PayPal Payment</p>
                  <p className="text-sm text-gray-700 mt-1">
                    Click &quot;Pay Now&quot; below to be redirected to PayPal to complete your payment securely.
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    Confirmation email will be sent to: <span className="font-semibold">{formData.email}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Payment Status Indicator */}
          {paymentStatus !== 'pending' && (
            <div className={`mt-4 p-4 rounded-xl border-2 animate-in fade-in duration-300 ${
              paymentStatus === 'approved' 
                ? 'bg-emerald-50 border-emerald-500' 
                : paymentStatus === 'processing'
                ? 'bg-amber-50 border-amber-500'
                : 'bg-red-50 border-red-500'
            }`}>
              <div className="flex items-center gap-3">
                {paymentStatus === 'approved' && (
                  <>
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    <div>
                      <p className="font-bold text-emerald-700">Payment Approved!</p>
                      <p className="text-sm text-emerald-600">You can now submit your application.</p>
                    </div>
                  </>
                )}
                {paymentStatus === 'processing' && (
                  <>
                    <Loader2 className="w-6 h-6 text-amber-600 animate-spin" />
                    <div>
                      <p className="font-bold text-amber-700">Payment Processing</p>
                      <p className="text-sm text-amber-600">
                        {formData.payment_method === 'mobile_money' 
                          ? 'Please approve the payment on your phone, then click "I\'ve Completed Payment".'
                          : 'Waiting for PayPal confirmation...'}
                      </p>
                    </div>
                  </>
                )}
                {paymentStatus === 'failed' && (
                  <>
                    <AlertCircle className="w-6 h-6 text-red-600" />
                    <div>
                      <p className="font-bold text-red-700">Payment Failed</p>
                      <p className="text-sm text-red-600">Please try again or choose a different payment method.</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Application Summary Card */}
      <div className="relative">
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 p-8 rounded-2xl shadow-md">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-emerald-600 rounded-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <p className="text-xl font-bold text-gray-900">
              Application Summary
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/60 backdrop-blur-sm p-4 rounded-xl border border-sky-200">
              <p className="text-sm text-gray-600 mb-1 flex items-center gap-2">
                <User className="w-4 h-4" /> Full Name
              </p>
              <p className="text-base font-semibold text-gray-900">{formData.full_name || 'Not provided'}</p>
            </div>
            <div className="bg-white/60 backdrop-blur-sm p-4 rounded-xl border border-sky-200">
              <p className="text-sm text-gray-600 mb-1 flex items-center gap-2">
                <Mail className="w-4 h-4" /> Email
              </p>
              <p className="text-base font-semibold text-gray-900 truncate">{formData.email || 'Not provided'}</p>
            </div>
            <div className="bg-white/60 backdrop-blur-sm p-4 rounded-xl border border-sky-200">
              <p className="text-sm text-gray-600 mb-1 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Excel Level
              </p>
              <p className="text-base font-semibold text-gray-900 capitalize">{formData.excel_skill_level.replace('_', ' ')}</p>
            </div>
            <div className="bg-white/60 backdrop-blur-sm p-4 rounded-xl border border-sky-200">
              <p className="text-sm text-gray-600 mb-1 flex items-center gap-2">
                <Monitor className="w-4 h-4" /> Has Computer
              </p>
              <p className="text-base font-semibold text-gray-900">{formData.has_computer ? 'Yes ✓' : 'No ✗'}</p>
            </div>
            <div className="bg-white/60 backdrop-blur-sm p-4 rounded-xl border border-sky-200 md:col-span-2">
              <p className="text-sm text-gray-600 mb-1 flex items-center gap-2">
                <Target className="w-4 h-4" /> Learning Mode
              </p>
              <p className="text-base font-semibold text-gray-900 capitalize">{formData.preferred_learning_mode?.replace('_', ' ') || 'Not selected'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const sectionTitles = [
    { num: 1, title: 'Applicant Information', desc: 'Tell us about yourself', icon: User },
    { num: 2, title: 'Education & Background', desc: 'Your professional journey', icon: GraduationCap },
    { num: 3, title: 'Excel & Computer Skills', desc: 'Current skill assessment', icon: Monitor },
    { num: 4, title: 'Learning Goals', desc: 'Your vision for the future', icon: Target },
    { num: 5, title: 'Access & Availability', desc: 'Logistics for learning', icon: Clock },
    { num: 6, title: 'Commitment & Agreement', desc: 'Final commitment', icon: Award },
  ];

  // Calculate progress percentage
  const progressPercentage = (currentSection / 6) * 100;
  
  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <Card className="shadow-xl border border-gray-200 bg-white overflow-hidden">
        <CardHeader className="border-b border-gray-200 bg-gray-50 pb-8">
          {/* Progress Bar with Animation */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3">
              <span className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                Section {currentSection} of 6
              </span>
              <span className="text-sm font-semibold text-emerald-700 bg-emerald-100 px-4 py-1.5 rounded-full">
                {Math.round(progressPercentage)}% Complete
              </span>
            </div>
            <div className="relative w-full bg-gray-200 rounded-full h-3 shadow-inner overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-700 ease-out shadow-md"
                style={{ width: `${progressPercentage}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
              </div>
            </div>
          </div>

          {/* Modern Section Indicators */}
          <div className="grid grid-cols-6 gap-3 mb-8">
            {sectionTitles.map((section) => {
              const IconComponent = section.icon;
              return (
                <div
                  key={section.num}
                  className={`relative text-center p-4 rounded-2xl transition-all duration-300 transform hover:scale-105 cursor-pointer ${
                    section.num === currentSection
                      ? 'bg-emerald-600 shadow-lg scale-105'
                      : section.num < currentSection
                      ? 'bg-emerald-100 border-2 border-emerald-400'
                      : 'bg-gray-100 border border-gray-300 opacity-70 hover:opacity-100'
                  }`}
                >
                  {section.num < currentSection && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <IconComponent 
                    className={`w-8 h-8 mx-auto mb-2 ${
                      section.num === currentSection 
                        ? 'text-white' 
                        : section.num < currentSection 
                        ? 'text-emerald-600' 
                        : 'text-gray-500'
                    }`} 
                  />
                  <div className={`text-xs font-semibold hidden sm:block ${
                    section.num === currentSection 
                      ? 'text-white' 
                      : section.num < currentSection 
                      ? 'text-emerald-700' 
                      : 'text-gray-600'
                  }`}>
                    {section.title.split(' ')[0]}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Section Title with Icon */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {(() => {
                const IconComponent = sectionTitles[currentSection - 1]?.icon;
                return (
                  <div className="p-4 bg-emerald-600 rounded-2xl shadow-md">
                    <IconComponent className="w-8 h-8 text-white" />
                  </div>
                );
              })()}
              <div>
                <CardTitle className="text-3xl font-bold text-gray-900">
                  {sectionTitles[currentSection - 1]?.title}
                </CardTitle>
                <p className="text-base text-gray-700 mt-1">
                  {sectionTitles[currentSection - 1]?.desc}
                </p>
              </div>
            </div>
            {courseTitle && (
              <div className="bg-emerald-50 border-l-4 border-emerald-600 p-4 rounded-r-xl">
                <CardDescription className="text-base flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-emerald-600" />
                  Applying for:{' '}
                  <strong className="text-emerald-700 font-bold">{courseTitle}</strong>
                </CardDescription>
              </div>
            )}
          </div>
        </CardHeader>

<CardContent className="pt-8 pb-8 px-8">
          {/* Global Error Message */}
          {error && (
            <Alert className="mb-8 border-red-300 bg-gradient-to-r from-red-50 to-rose-50 shadow-lg">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <AlertDescription className="ml-2">
                <p className="font-bold text-red-900 mb-2 text-lg">Application Error</p>
              <p className="text-red-700">{error}</p>
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          {renderSection()}

          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 mt-12 pt-8 border-t-2 border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={currentSection === 1 ? (onCancel || (() => window.history.back())) : handlePrevious}
              disabled={loading || paymentLoading}
              className="px-8 py-6 text-lg border-2 hover:bg-gray-50 rounded-xl transition-all duration-300 font-semibold"
            >
              <ChevronLeft className="w-5 h-5 mr-2" />
              {currentSection === 1 ? 'Cancel' : 'Previous'}
            </Button>

            {currentSection < 6 ? (
              <Button 
                type="button" 
                onClick={handleNext}
                className="px-10 py-6 text-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md hover:shadow-lg transition-all duration-300 rounded-xl"
              >
                Next Section
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Pay Now Button - Only shown for paid courses when payment not yet approved */}
                {courseData?.enrollment_type === 'paid' && paymentStatus !== 'approved' && (
                  <>
                    {paymentStatus === 'processing' ? (
                      <Button 
                        type="button"
                        onClick={handleConfirmPayment}
                        disabled={paymentLoading}
                        className="px-10 py-7 text-lg bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl"
                      >
                        {paymentLoading ? (
                          <>
                            <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                            Verifying Payment...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-6 h-6 mr-3" />
                            I&apos;ve Completed Payment
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button 
                        type="button"
                        onClick={handlePayNow}
                        disabled={paymentLoading || existingApplication}
                        className="px-10 py-7 text-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl"
                      >
                        {paymentLoading ? (
                          <>
                            <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                            Initiating Payment...
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-6 h-6 mr-3" />
                            Pay Now ({courseData?.currency || 'USD'} {courseData?.price})
                          </>
                        )}
                      </Button>
                    )}
                  </>
                )}

                {/* Payment Status Indicator */}
                {courseData?.enrollment_type === 'paid' && paymentStatus === 'approved' && (
                  <div className="flex items-center gap-2 px-6 py-4 bg-emerald-100 border-2 border-emerald-500 rounded-2xl">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    <span className="font-bold text-emerald-700">Payment Approved!</span>
                  </div>
                )}

                {/* Submit Application Button */}
                <Button 
                  type="submit" 
                  disabled={
                    loading || 
                    existingApplication || 
                    (courseData?.enrollment_type === 'paid' && paymentStatus !== 'approved')
                  }
                  className={`px-12 py-7 text-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed ${
                    courseData?.enrollment_type === 'paid' && paymentStatus !== 'approved'
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                      Submitting Application...
                    </>
                  ) : existingApplication ? (
                    'Already Applied'
                  ) : courseData?.enrollment_type === 'paid' && paymentStatus !== 'approved' ? (
                    <>
                      <AlertCircle className="w-6 h-6 mr-3" />
                      Pay First to Submit
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-6 h-6 mr-3" />
                      Submit Application
                      <CheckCircle2 className="w-6 h-6 ml-3" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
    </div>
  );
}