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
import { CheckCircle2, AlertCircle, Loader2, ChevronRight, ChevronLeft, AlertTriangle } from 'lucide-react';

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
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
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
    
    if (!validateSection(6)) return;

    setLoading(true);
    setError(null);

    try {
      const response = await applicationService.submitApplication(formData);
      
      if (response && response.application_id) {
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
      <Card className="max-w-2xl mx-auto shadow-xl border-green-200">
        <CardContent className="pt-6">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-4 bg-green-100 rounded-full">
                <CheckCircle2 className="w-16 h-16 text-green-600" />
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Application Submitted Successfully!</h2>
              <p className="text-gray-600 text-lg">
                Thank you for applying to <strong className="text-sky-600">{courseTitle || 'the course'}</strong>
              </p>
            </div>
            
            {applicationId && (
              <div className="bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-200 p-6 rounded-xl">
                <p className="text-gray-700 mb-2">
                  <strong className="text-lg">Application ID:</strong>
                  <span className="ml-2 text-2xl font-mono font-bold text-sky-700">#{applicationId}</span>
                </p>
                <p className="text-sm text-gray-500">
                  💡 Save this ID to track your application status
                </p>
              </div>
            )}

            {scores && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Your Application Scores</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 p-4 rounded-xl">
                    <p className="text-sm text-blue-700 font-semibold mb-1">Application Score</p>
                    <p className="text-3xl font-bold text-blue-800">{scores.application_score}<span className="text-lg">/100</span></p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 p-4 rounded-xl">
                    <p className="text-sm text-green-700 font-semibold mb-1">Readiness Score</p>
                    <p className="text-3xl font-bold text-green-800">{scores.readiness_score}<span className="text-lg">/100</span></p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 p-4 rounded-xl">
                    <p className="text-sm text-purple-700 font-semibold mb-1">Commitment Score</p>
                    <p className="text-3xl font-bold text-purple-800">{scores.commitment_score}<span className="text-lg">/100</span></p>
                  </div>
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 p-4 rounded-xl">
                    <p className="text-sm text-amber-700 font-semibold mb-1">Final Rank</p>
                    <p className="text-3xl font-bold text-amber-800">{scores.final_rank}<span className="text-lg">/100</span></p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl text-left">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                What Happens Next?
              </h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Confirmation email sent to <strong>{formData.email}</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Our team will review your application within 2-3 business days</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>You'll receive an email notification once your application is processed</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Check your spam folder if you don't see our email</span>
                </li>
              </ul>
            </div>

            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => window.location.href = '/courses'}
                className="bg-sky-600 hover:bg-sky-700 text-white px-8"
              >
                Browse More Courses
              </Button>
              {onCancel && (
                <Button
                  variant="outline"
                  onClick={onCancel}
                  className="px-8"
                >
                  Go Back
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
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
    <div className="space-y-4">
      {/* Duplicate Application Warning */}
      {existingApplication && (
        <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertDescription className="ml-2">
            <div className="space-y-2">
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                You have already applied for this course!
              </p>
              <div className="text-sm text-amber-800 dark:text-amber-300 space-y-1">
                <p>
                  <strong>Application ID:</strong> #{existingApplication.id}
                </p>
                <p>
                  <strong>Status:</strong> <span className="capitalize">{existingApplication.status}</span>
                </p>
                {existingApplication.submitted_at && (
                  <p>
                    <strong>Submitted:</strong> {new Date(existingApplication.submitted_at).toLocaleDateString()}
                  </p>
                )}
                {existingApplication.final_rank && (
                  <p>
                    <strong>Final Rank:</strong> {existingApplication.final_rank}/100
                  </p>
                )}
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-400 pt-2">
                Please check your email ({formData.email}) for updates on your application status.
                You cannot submit multiple applications for the same course.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Email checking indicator */}
      {checkingDuplicate && (
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 border border-blue-200 p-3 rounded-lg">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Checking if you've already applied...</span>
        </div>
      )}

      <div>
        <Label htmlFor="full_name">Full Name <span className="text-red-500">*</span></Label>
        <Input
          id="full_name"
          value={formData.full_name}
          onChange={(e) => handleInputChange('full_name', e.target.value)}
          placeholder="Your full legal name"
          className={validationErrors.full_name ? 'border-red-500' : ''}
        />
        <p className="text-xs text-gray-500 mt-1">
          Please ensure this matches your official identification.
        </p>
        {validationErrors.full_name && (
          <p className="text-xs text-red-500 mt-1">{validationErrors.full_name}</p>
        )}
      </div>

      <div>
        <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          onBlur={handleEmailBlur}
          placeholder="your.email@example.com"
          className={validationErrors.email ? 'border-red-500' : ''}
          disabled={checkingDuplicate}
        />
        <p className="text-xs text-gray-500 mt-1">
          We will use this for all official communication and check for duplicate applications.
        </p>
        {validationErrors.email && (
          <p className="text-xs text-red-500 mt-1">{validationErrors.email}</p>
        )}
      </div>

      <div>
        <Label htmlFor="phone">Phone Number <span className="text-red-500">*</span></Label>
        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => handleInputChange('phone', e.target.value)}
          placeholder="+234-801-234-5678"
          className={validationErrors.phone ? 'border-red-500' : ''}
        />
        <p className="text-xs text-gray-500 mt-1">
          Include country code (e.g., +234).
        </p>
        {validationErrors.phone && (
          <p className="text-xs text-red-500 mt-1">{validationErrors.phone}</p>
        )}
      </div>

      <div>
        <Label htmlFor="whatsapp">WhatsApp Contact Number</Label>
        <Input
          id="whatsapp"
          value={formData.whatsapp_number}
          onChange={(e) => handleInputChange('whatsapp_number', e.target.value)}
          placeholder="Same as phone or different"
        />
        <p className="text-xs text-gray-500 mt-1">
          We may use WhatsApp for quick updates.
        </p>
      </div>

      <div>
        <Label htmlFor="gender">Gender</Label>
        <Select
          value={formData.gender}
          onValueChange={(value) => handleInputChange('gender', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Please select your gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="female">Female</SelectItem>
            <SelectItem value="other">Other</SelectItem>
            <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="age_range">Age Range</Label>
        <Select
          value={formData.age_range}
          onValueChange={(value) => handleInputChange('age_range', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Your age group" />
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
        <p className="text-xs text-gray-500 mt-1">
          This helps us tailor content to different learning styles.
        </p>
      </div>

      <div>
        <Label htmlFor="country">Country</Label>
        <Input
          id="country"
          value={formData.country}
          onChange={(e) => handleInputChange('country', e.target.value)}
          placeholder="Which country are you applying from?"
        />
        <p className="text-xs text-gray-500 mt-1">
          We prioritize applicants from African countries.
        </p>
      </div>

      <div>
        <Label htmlFor="city">City / District</Label>
        <Input
          id="city"
          value={formData.city}
          onChange={(e) => handleInputChange('city', e.target.value)}
          placeholder="Your current city or district"
        />
      </div>
    </div>
  );

  const renderEducationBackground = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="education_level">Highest Level of Education</Label>
        <Select
          value={formData.education_level}
          onValueChange={(value) => handleInputChange('education_level', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="What is your highest academic qualification?" />
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
        <Label htmlFor="current_status">Current Status</Label>
        <Select
          value={formData.current_status}
          onValueChange={(value) => handleInputChange('current_status', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="What is your current professional status?" />
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
        <Label htmlFor="field_of_study">Field of Study / Profession</Label>
        <Input
          id="field_of_study"
          value={formData.field_of_study}
          onChange={(e) => handleInputChange('field_of_study', e.target.value)}
          placeholder="E.g., Finance, Marketing, Engineering, Student"
        />
        <p className="text-xs text-gray-500 mt-1">
          What is your main field of study or profession?
        </p>
      </div>
    </div>
  );

  const renderExcelSkills = () => (
    <div className="space-y-4">
      <div>
        <Label>Have you used Microsoft Excel before?</Label>
        <div className="flex items-center space-x-4 mt-2">
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              name="has_used_excel"
              checked={formData.has_used_excel === true}
              onChange={() => handleInputChange('has_used_excel', true)}
              className="w-4 h-4"
            />
            <span>Yes</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              name="has_used_excel"
              checked={formData.has_used_excel === false}
              onChange={() => handleInputChange('has_used_excel', false)}
              className="w-4 h-4"
            />
            <span>No</span>
          </label>
        </div>
      </div>

      <div>
        <Label htmlFor="excel_skill_level">Your Excel Skill Level</Label>
        <Select
          value={formData.excel_skill_level}
          onValueChange={(value) => handleInputChange('excel_skill_level', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="How would you rate your current Excel skill level?" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="never_used">Never Used Excel</SelectItem>
            <SelectItem value="beginner">Beginner (Basic navigation)</SelectItem>
            <SelectItem value="intermediate">Intermediate (Formulas, charts)</SelectItem>
            <SelectItem value="advanced">Advanced (Pivot tables, VLOOKUP)</SelectItem>
            <SelectItem value="expert">Expert (Macros, Power Query)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1">
          Be honest! This helps us place you in the right group.
        </p>
      </div>

      {formData.has_used_excel && (
        <div>
          <Label>Which Excel tasks have you done before?</Label>
          <p className="text-xs text-gray-500 mb-2">Select all that apply</p>
          <div className="space-y-2">
            {EXCEL_TASKS.map((task) => (
              <label key={task.value} className="flex items-center space-x-2">
                <Checkbox
                  checked={(formData.excel_tasks_done || []).includes(task.value)}
                  onCheckedChange={() => handleMultiSelect('excel_tasks_done', task.value)}
                />
                <span className="text-sm">{task.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderLearningGoals = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="motivation">
          Why do you want to join this course? <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="motivation"
          value={formData.motivation}
          onChange={(e) => handleInputChange('motivation', e.target.value)}
          placeholder="Tell us what sparked your interest in Excel Mastery..."
          rows={4}
          className={validationErrors.motivation ? 'border-red-500' : ''}
        />
        <div className="flex justify-between items-center mt-1">
          <p className="text-xs text-gray-500">
            Your motivation for taking this course (minimum 50 characters)
          </p>
          <p className="text-xs text-gray-400">
            {formData.motivation.length} characters
          </p>
        </div>
        {validationErrors.motivation && (
          <p className="text-xs text-red-500 mt-1">{validationErrors.motivation}</p>
        )}
      </div>

      <div>
        <Label htmlFor="learning_outcomes">What do you want to achieve after completing this course?</Label>
        <Textarea
          id="learning_outcomes"
          value={formData.learning_outcomes}
          onChange={(e) => handleInputChange('learning_outcomes', e.target.value)}
          placeholder="E.g., Get a promotion, start a business, pass a certification..."
          rows={3}
        />
        <p className="text-xs text-gray-500 mt-1">
          Your specific learning outcomes
        </p>
      </div>

      <div>
        <Label htmlFor="career_impact">How will Excel skills help your career or business?</Label>
        <Textarea
          id="career_impact"
          value={formData.career_impact}
          onChange={(e) => handleInputChange('career_impact', e.target.value)}
          placeholder="Think about the real-world impact..."
          rows={3}
        />
        <p className="text-xs text-gray-500 mt-1">
          Connect Excel to your professional growth
        </p>
      </div>
    </div>
  );

  const renderAccessAvailability = () => (
    <div className="space-y-4">
      <div>
        <Label>Do you have access to a computer or laptop?</Label>
        <div className="flex items-center space-x-4 mt-2">
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              name="has_computer"
              checked={formData.has_computer === true}
              onChange={() => handleInputChange('has_computer', true)}
              className="w-4 h-4"
            />
            <span>Yes</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              name="has_computer"
              checked={formData.has_computer === false}
              onChange={() => handleInputChange('has_computer', false)}
              className="w-4 h-4"
            />
            <span>No</span>
          </label>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          A personal device is highly recommended for practice.
        </p>
      </div>

      <div>
        <Label htmlFor="internet_access_type">Internet Access Type</Label>
        <Select
          value={formData.internet_access_type}
          onValueChange={(value) => handleInputChange('internet_access_type', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="How do you primarily access the internet?" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="stable_broadband">Stable Broadband / WiFi</SelectItem>
            <SelectItem value="mobile_data">Mobile Data</SelectItem>
            <SelectItem value="limited_access">Limited Access</SelectItem>
            <SelectItem value="public_wifi">Public WiFi / Cafe</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1">
          This helps us plan for data usage and connectivity challenges.
        </p>
      </div>

      <div>
        <Label htmlFor="preferred_learning_mode">Preferred Learning Mode</Label>
        <Select
          value={formData.preferred_learning_mode}
          onValueChange={(value) => handleInputChange('preferred_learning_mode', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="How do you prefer to learn?" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="self_paced">Self-Paced (Learn at my own speed)</SelectItem>
            <SelectItem value="live_sessions">Live Sessions (Interactive classes)</SelectItem>
            <SelectItem value="hybrid">Hybrid (Mix of both)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Available Time for Learning</Label>
        <p className="text-xs text-gray-500 mb-2">
          When are you most available to dedicate time to the course? (Select all that work for you)
        </p>
        <div className="space-y-2">
          {TIME_SLOTS.map((slot) => (
            <label key={slot.value} className="flex items-center space-x-2">
              <Checkbox
                checked={(formData.available_time || []).includes(slot.value)}
                onCheckedChange={() => handleMultiSelect('available_time', slot.value)}
              />
              <span className="text-sm">{slot.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderCommitment = () => (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please review and confirm your commitment to the course requirements.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div className="flex items-start space-x-3 p-4 border rounded-lg">
          <Checkbox
            id="committed"
            checked={formData.committed_to_complete}
            onCheckedChange={(checked) => handleCheckboxChange('committed_to_complete', checked as boolean)}
            className={validationErrors.committed_to_complete ? 'border-red-500' : ''}
          />
          <div className="flex-1">
            <Label htmlFor="committed" className="font-medium cursor-pointer">
              Are you committed to completing the full course?
            </Label>
            <p className="text-sm text-gray-500 mt-1">
              We are looking for dedicated learners! Your commitment is key to your success.
            </p>
            {validationErrors.committed_to_complete && (
              <p className="text-xs text-red-500 mt-1">{validationErrors.committed_to_complete}</p>
            )}
          </div>
        </div>

        <div className="flex items-start space-x-3 p-4 border rounded-lg">
          <Checkbox
            id="assessments"
            checked={formData.agrees_to_assessments}
            onCheckedChange={(checked) => handleCheckboxChange('agrees_to_assessments', checked as boolean)}
            className={validationErrors.agrees_to_assessments ? 'border-red-500' : ''}
          />
          <div className="flex-1">
            <Label htmlFor="assessments" className="font-medium cursor-pointer">
              Do you agree to attend assessments and practical projects?
            </Label>
            <p className="text-sm text-gray-500 mt-1">
              I agree to participate fully in all required course activities.
            </p>
            {validationErrors.agrees_to_assessments && (
              <p className="text-xs text-red-500 mt-1">{validationErrors.agrees_to_assessments}</p>
            )}
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="referral_source">How did you hear about this course?</Label>
        <Input
          id="referral_source"
          value={formData.referral_source}
          onChange={(e) => handleInputChange('referral_source', e.target.value)}
          placeholder="E.g., Facebook, Friend referral, Google search..."
        />
        <p className="text-xs text-gray-500 mt-1">
          Please let us know how you found us.
        </p>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-sm text-blue-900 font-medium">
          📌 Application Summary
        </p>
        <ul className="text-xs text-blue-800 mt-2 space-y-1">
          <li>• Name: {formData.full_name || 'Not provided'}</li>
          <li>• Email: {formData.email || 'Not provided'}</li>
          <li>• Excel Level: {formData.excel_skill_level.replace('_', ' ')}</li>
          <li>• Has Computer: {formData.has_computer ? 'Yes' : 'No'}</li>
          <li>• Learning Mode: {formData.preferred_learning_mode || 'Not selected'}</li>
        </ul>
      </div>
    </div>
  );

  const sectionTitles = [
    { num: 1, title: 'Applicant Information', desc: 'Personal details', icon: '👤' },
    { num: 2, title: 'Education & Background', desc: 'Your professional profile', icon: '🎓' },
    { num: 3, title: 'Excel & Computer Skills', desc: 'Current skills assessment', icon: '💻' },
    { num: 4, title: 'Learning Goals', desc: 'Your vision for the future', icon: '🎯' },
    { num: 5, title: 'Access & Availability', desc: 'Logistics for learning', icon: '⏰' },
    { num: 6, title: 'Commitment & Agreement', desc: 'Final steps', icon: '✅' },
  ];

  // Calculate progress percentage
  const progressPercentage = (currentSection / 6) * 100;
  
  return (
    <Card className="max-w-4xl mx-auto shadow-xl border-sky-200">
      <CardHeader className="border-b border-gray-200">
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Section {currentSection} of 6
            </span>
            <span className="text-sm text-gray-600">
              {Math.round(progressPercentage)}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-gradient-to-r from-sky-500 to-blue-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Section Indicators */}
        <div className="grid grid-cols-6 gap-2 mb-6">
          {sectionTitles.map((section) => (
            <div
              key={section.num}
              className={`text-center p-2 rounded-lg transition-all ${
                section.num === currentSection
                  ? 'bg-sky-100 border-2 border-sky-500'
                  : section.num < currentSection
                  ? 'bg-green-100 border border-green-300'
                  : 'bg-gray-100 border border-gray-300'
              }`}
            >
              <div className="text-2xl mb-1">{section.icon}</div>
              <div className="text-xs font-medium text-gray-700 hidden sm:block">
                {section.title.split(' ')[0]}
              </div>
            </div>
          ))}
        </div>

        <CardTitle className="text-2xl">
          {sectionTitles[currentSection - 1]?.icon} {sectionTitles[currentSection - 1]?.title}
        </CardTitle>
        {courseTitle && (
          <CardDescription className="text-base mt-2">
            Applying for: <strong className="text-sky-700">{courseTitle}</strong>
          </CardDescription>
        )}
        <p className="text-sm text-gray-600 mt-2">
          {sectionTitles[currentSection - 1]?.desc}
        </p>
      </CardHeader>

      <CardContent className="pt-6">
        {/* Global Error Message */}
        {error && (
          <Alert className="mb-6 border-red-300 bg-red-50">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <AlertDescription className="ml-2">
              <p className="font-semibold text-red-900 mb-1">Application Error</p>
              <p className="text-red-700">{error}</p>
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          {renderSection()}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={currentSection === 1 ? (onCancel || (() => window.history.back())) : handlePrevious}
              disabled={loading}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              {currentSection === 1 ? 'Cancel' : 'Previous'}
            </Button>

            {currentSection < 6 ? (
              <Button type="button" onClick={handleNext}>
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button 
                type="submit" 
                disabled={loading || existingApplication}
                className="bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-semibold px-8 py-6 text-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Submitting Application...
                  </>
                ) : existingApplication ? (
                  'Already Applied'
                ) : (
                  <>
                    Submit Application
                    <CheckCircle2 className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            )}
            
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="px-6"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}