'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { CheckCircle2, AlertCircle, Loader2, ChevronRight, ChevronLeft, AlertTriangle, User, Mail, Phone, Globe, GraduationCap, Briefcase, Monitor, Target, Clock, Award, Sparkles, TrendingUp, Shield, Zap, CreditCard, Copy, Check, Building2 } from 'lucide-react';
import { AutoSaveIndicator, DraftRestoreBanner } from '@/components/ui/form-components';
import { CurrencySelector, ConvertedBadge } from '@/components/ui/CurrencyDisplay';
import type { AutoSaveStatus } from '@/hooks/useAutoSave';

interface CourseApplicationFormProps {
  courseId: number;
  courseTitle?: string;
  courseData?: Course; // Full course data passed from parent
  onSuccess?: (applicationId: number) => void;
  onCancel?: () => void;
}

// ============== Course-specific skill configurations ==============
interface CourseSkillConfig {
  subjectName: string;
  shortName: string;
  sectionTitle: string;
  sectionDesc: string;
  hasUsedQuestion: string;
  skillLevelLabel: string;
  skillLevelPlaceholder: string;
  skillLevels: { value: string; label: string }[];
  tasksLabel: string;
  tasks: { value: string; label: string }[];
  motivationPlaceholder: string;
  learningOutcomesPlaceholder: string;
  careerImpactLabel: string;
  careerImpactPlaceholder: string;
  careerImpactHelperText: string;
}

function getCourseSkillConfig(courseTitle?: string): CourseSkillConfig {
  const title = (courseTitle || '').toLowerCase();

  // ---------- Excel / Spreadsheet courses ----------
  if (title.includes('excel') || title.includes('spreadsheet')) {
    return {
      subjectName: 'Microsoft Excel',
      shortName: 'Excel',
      sectionTitle: 'Excel & Computer Skills',
      sectionDesc: 'Current skill assessment',
      hasUsedQuestion: 'Have you used Microsoft Excel before?',
      skillLevelLabel: 'Your Excel Skill Level',
      skillLevelPlaceholder: 'How would you rate your current Excel skill level?',
      skillLevels: [
        { value: 'never_used', label: 'Never Used Excel' },
        { value: 'beginner', label: 'Beginner (Basic navigation)' },
        { value: 'intermediate', label: 'Intermediate (Formulas, charts)' },
        { value: 'advanced', label: 'Advanced (Pivot tables, VLOOKUP)' },
        { value: 'expert', label: 'Expert (Macros, Power Query)' },
      ],
      tasksLabel: 'Which Excel tasks have you done before?',
      tasks: [
        { value: 'basic_formulas', label: 'Basic Formulas (SUM, AVERAGE, COUNT)' },
        { value: 'vlookup_hlookup', label: 'VLOOKUP / HLOOKUP' },
        { value: 'pivot_tables', label: 'Pivot Tables' },
        { value: 'charts_graphs', label: 'Charts and Graphs' },
        { value: 'conditional_formatting', label: 'Conditional Formatting' },
        { value: 'data_validation', label: 'Data Validation' },
        { value: 'macros_vba', label: 'Macros / VBA' },
        { value: 'power_query', label: 'Power Query' },
        { value: 'dashboard_creation', label: 'Dashboard Creation' },
      ],
      motivationPlaceholder: 'Tell us what sparked your interest in Excel Mastery... Share your story, your challenges, and what drives you to learn this skill.',
      learningOutcomesPlaceholder: 'E.g., Get a promotion, start a data analytics business, pass Excel certification, build financial models...',
      careerImpactLabel: 'How will Excel skills help your career or business?',
      careerImpactPlaceholder: 'Think about the real-world impact... Will it help you analyze data better? Make reports? Automate tasks? Scale your business?',
      careerImpactHelperText: 'Connect Excel to your professional growth',
    };
  }

  // ---------- Python / Programming courses ----------
  if (title.includes('python') || title.includes('programming') || title.includes('coding')) {
    return {
      subjectName: 'Python Programming',
      shortName: 'Python',
      sectionTitle: 'Programming Skills',
      sectionDesc: 'Current programming experience',
      hasUsedQuestion: 'Have you written code in any programming language before?',
      skillLevelLabel: 'Your Programming Skill Level',
      skillLevelPlaceholder: 'How would you rate your current programming skills?',
      skillLevels: [
        { value: 'never_used', label: 'Never Written Code' },
        { value: 'beginner', label: 'Beginner (Hello World, basic syntax)' },
        { value: 'intermediate', label: 'Intermediate (Functions, loops, conditionals)' },
        { value: 'advanced', label: 'Advanced (OOP, libraries, APIs)' },
        { value: 'expert', label: 'Expert (Frameworks, deployment, testing)' },
      ],
      tasksLabel: 'Which programming tasks have you done before?',
      tasks: [
        { value: 'basic_syntax', label: 'Basic Syntax & Variables' },
        { value: 'functions', label: 'Functions & Methods' },
        { value: 'data_structures', label: 'Lists, Dictionaries & Data Structures' },
        { value: 'file_io', label: 'File Reading / Writing' },
        { value: 'oop', label: 'Object-Oriented Programming' },
        { value: 'web_scraping', label: 'Web Scraping' },
        { value: 'api_integration', label: 'API Integration' },
        { value: 'database', label: 'Database Operations' },
        { value: 'automation', label: 'Task Automation Scripts' },
      ],
      motivationPlaceholder: 'Tell us what sparked your interest in learning Python... What problems do you want to solve? What projects do you dream of building?',
      learningOutcomesPlaceholder: 'E.g., Build web applications, automate tasks, analyze data, transition into tech, create AI projects...',
      careerImpactLabel: 'How will programming skills help your career or business?',
      careerImpactPlaceholder: 'Think about the real-world impact... Will it help you automate work? Build products? Transition to a tech career? Start a business?',
      careerImpactHelperText: 'Connect programming skills to your professional growth',
    };
  }

  // ---------- Data Science / Analytics courses ----------
  if (title.includes('data science') || title.includes('data analy') || title.includes('analytics') || title.includes('machine learning') || title.includes('ai ') || title.includes('artificial intelligence')) {
    return {
      subjectName: 'Data Science & Analytics',
      shortName: 'Data Science',
      sectionTitle: 'Data & Analytics Skills',
      sectionDesc: 'Current technical experience',
      hasUsedQuestion: 'Have you worked with data analysis tools before?',
      skillLevelLabel: 'Your Data Analysis Skill Level',
      skillLevelPlaceholder: 'How would you rate your current data skills?',
      skillLevels: [
        { value: 'never_used', label: 'No Data Analysis Experience' },
        { value: 'beginner', label: 'Beginner (Basic spreadsheets)' },
        { value: 'intermediate', label: 'Intermediate (SQL, basic statistics)' },
        { value: 'advanced', label: 'Advanced (Python/R, visualizations)' },
        { value: 'expert', label: 'Expert (ML models, big data tools)' },
      ],
      tasksLabel: 'Which data-related tasks have you done before?',
      tasks: [
        { value: 'spreadsheet_analysis', label: 'Spreadsheet Analysis (Excel/Google Sheets)' },
        { value: 'sql_queries', label: 'SQL Queries & Databases' },
        { value: 'data_cleaning', label: 'Data Cleaning & Preparation' },
        { value: 'data_visualization', label: 'Data Visualization (Charts, Dashboards)' },
        { value: 'statistics', label: 'Statistical Analysis' },
        { value: 'python_r', label: 'Python or R for Data Analysis' },
        { value: 'machine_learning', label: 'Machine Learning Models' },
        { value: 'bi_tools', label: 'BI Tools (Power BI, Tableau)' },
        { value: 'reporting', label: 'Report Writing & Presentation' },
      ],
      motivationPlaceholder: 'Tell us what sparked your interest in data science... What data problems fascinate you? What insights do you want to uncover?',
      learningOutcomesPlaceholder: 'E.g., Become a data analyst, build ML models, make data-driven decisions, start a consulting business...',
      careerImpactLabel: 'How will data skills help your career or business?',
      careerImpactPlaceholder: 'Think about the real-world impact... Will it help you make better decisions? Find patterns in data? Build predictive models?',
      careerImpactHelperText: 'Connect data skills to your professional growth',
    };
  }

  // ---------- Web Development courses ----------
  if (title.includes('web') || title.includes('frontend') || title.includes('front-end') || title.includes('backend') || title.includes('back-end') || title.includes('fullstack') || title.includes('full-stack') || title.includes('javascript') || title.includes('react') || title.includes('next')) {
    return {
      subjectName: 'Web Development',
      shortName: 'Web Dev',
      sectionTitle: 'Web Development Skills',
      sectionDesc: 'Current development experience',
      hasUsedQuestion: 'Have you built websites or web applications before?',
      skillLevelLabel: 'Your Web Development Skill Level',
      skillLevelPlaceholder: 'How would you rate your current web development skills?',
      skillLevels: [
        { value: 'never_used', label: 'No Web Development Experience' },
        { value: 'beginner', label: 'Beginner (Basic HTML/CSS)' },
        { value: 'intermediate', label: 'Intermediate (JavaScript, responsive design)' },
        { value: 'advanced', label: 'Advanced (Frameworks, APIs, databases)' },
        { value: 'expert', label: 'Expert (Full-stack, deployment, DevOps)' },
      ],
      tasksLabel: 'Which web development tasks have you done before?',
      tasks: [
        { value: 'html_css', label: 'HTML & CSS Layouts' },
        { value: 'javascript', label: 'JavaScript / TypeScript' },
        { value: 'responsive_design', label: 'Responsive Design' },
        { value: 'frontend_framework', label: 'Frontend Frameworks (React, Vue, Angular)' },
        { value: 'backend_dev', label: 'Backend Development (Node, Python, PHP)' },
        { value: 'database', label: 'Database Design (SQL, MongoDB)' },
        { value: 'api_development', label: 'REST or GraphQL APIs' },
        { value: 'deployment', label: 'Deployment & Hosting' },
        { value: 'version_control', label: 'Git & Version Control' },
      ],
      motivationPlaceholder: 'Tell us what sparked your interest in web development... What kind of websites or apps do you dream of building?',
      learningOutcomesPlaceholder: 'E.g., Build portfolio sites, create web apps, freelance as a developer, get hired as a web developer...',
      careerImpactLabel: 'How will web development skills help your career or business?',
      careerImpactPlaceholder: 'Think about the real-world impact... Will it help you build your own products? Freelance? Get a developer job? Launch a startup?',
      careerImpactHelperText: 'Connect web development to your professional growth',
    };
  }

  // ---------- Design / UI/UX courses ----------
  if (title.includes('design') || title.includes('ui') || title.includes('ux') || title.includes('graphic') || title.includes('figma')) {
    return {
      subjectName: 'Design',
      shortName: 'Design',
      sectionTitle: 'Design Skills',
      sectionDesc: 'Current design experience',
      hasUsedQuestion: 'Have you used design tools before?',
      skillLevelLabel: 'Your Design Skill Level',
      skillLevelPlaceholder: 'How would you rate your current design skills?',
      skillLevels: [
        { value: 'never_used', label: 'No Design Experience' },
        { value: 'beginner', label: 'Beginner (Basic tools usage)' },
        { value: 'intermediate', label: 'Intermediate (Layouts, typography, color)' },
        { value: 'advanced', label: 'Advanced (Prototyping, user research)' },
        { value: 'expert', label: 'Expert (Design systems, complex interactions)' },
      ],
      tasksLabel: 'Which design tasks have you done before?',
      tasks: [
        { value: 'graphic_design', label: 'Graphic Design (Posters, Social Media)' },
        { value: 'ui_design', label: 'UI Design (Mobile or Web)' },
        { value: 'prototyping', label: 'Prototyping & Wireframing' },
        { value: 'user_research', label: 'User Research & Testing' },
        { value: 'figma_sketch', label: 'Figma, Sketch, or Adobe XD' },
        { value: 'branding', label: 'Branding & Logo Design' },
        { value: 'motion_design', label: 'Motion Design & Animation' },
        { value: 'design_systems', label: 'Design Systems & Components' },
        { value: 'print_design', label: 'Print Design & Layouts' },
      ],
      motivationPlaceholder: 'Tell us what sparked your interest in design... What kind of products or experiences do you want to create?',
      learningOutcomesPlaceholder: 'E.g., Design mobile apps, create brand identities, become a UX designer, build a design portfolio...',
      careerImpactLabel: 'How will design skills help your career or business?',
      careerImpactPlaceholder: 'Think about the real-world impact... Will it help you create better products? Start a design agency? Improve user experiences?',
      careerImpactHelperText: 'Connect design skills to your professional growth',
    };
  }

  // ---------- Digital Marketing courses ----------
  if (title.includes('marketing') || title.includes('seo') || title.includes('social media') || title.includes('digital marketing')) {
    return {
      subjectName: 'Digital Marketing',
      shortName: 'Marketing',
      sectionTitle: 'Marketing Skills',
      sectionDesc: 'Current marketing experience',
      hasUsedQuestion: 'Have you worked with digital marketing tools or campaigns before?',
      skillLevelLabel: 'Your Digital Marketing Skill Level',
      skillLevelPlaceholder: 'How would you rate your current marketing skills?',
      skillLevels: [
        { value: 'never_used', label: 'No Marketing Experience' },
        { value: 'beginner', label: 'Beginner (Personal social media)' },
        { value: 'intermediate', label: 'Intermediate (Managed business pages)' },
        { value: 'advanced', label: 'Advanced (Paid ads, analytics, campaigns)' },
        { value: 'expert', label: 'Expert (Strategy, automation, multi-channel)' },
      ],
      tasksLabel: 'Which marketing tasks have you done before?',
      tasks: [
        { value: 'social_media', label: 'Social Media Management' },
        { value: 'content_creation', label: 'Content Creation (Blog, Video)' },
        { value: 'email_marketing', label: 'Email Marketing Campaigns' },
        { value: 'seo', label: 'Search Engine Optimization (SEO)' },
        { value: 'paid_ads', label: 'Paid Advertising (Google, Facebook)' },
        { value: 'analytics', label: 'Web Analytics & Reports' },
        { value: 'copywriting', label: 'Copywriting & Messaging' },
        { value: 'marketing_strategy', label: 'Marketing Strategy & Planning' },
        { value: 'community_building', label: 'Community Building & Engagement' },
      ],
      motivationPlaceholder: 'Tell us what sparked your interest in digital marketing... What brands or campaigns inspire you? What audience do you want to reach?',
      learningOutcomesPlaceholder: 'E.g., Grow a brand online, run paid ad campaigns, become a marketing specialist, increase business revenue...',
      careerImpactLabel: 'How will marketing skills help your career or business?',
      careerImpactPlaceholder: 'Think about the real-world impact... Will it help you grow a brand? Attract customers? Start a marketing agency? Get hired?',
      careerImpactHelperText: 'Connect marketing skills to your professional growth',
    };
  }

  // ---------- Project Management courses ----------
  if (title.includes('project management') || title.includes('agile') || title.includes('scrum') || title.includes('pmp')) {
    return {
      subjectName: 'Project Management',
      shortName: 'Project Mgmt',
      sectionTitle: 'Project Management Skills',
      sectionDesc: 'Current management experience',
      hasUsedQuestion: 'Have you managed projects or teams before?',
      skillLevelLabel: 'Your Project Management Skill Level',
      skillLevelPlaceholder: 'How would you rate your current project management skills?',
      skillLevels: [
        { value: 'never_used', label: 'No Project Management Experience' },
        { value: 'beginner', label: 'Beginner (Managed personal tasks)' },
        { value: 'intermediate', label: 'Intermediate (Led small projects)' },
        { value: 'advanced', label: 'Advanced (Multi-team coordination)' },
        { value: 'expert', label: 'Expert (Certified, large-scale projects)' },
      ],
      tasksLabel: 'Which project management activities have you done before?',
      tasks: [
        { value: 'task_planning', label: 'Task Planning & Scheduling' },
        { value: 'team_coordination', label: 'Team Coordination' },
        { value: 'budgeting', label: 'Budget Management' },
        { value: 'risk_management', label: 'Risk Assessment & Mitigation' },
        { value: 'agile_scrum', label: 'Agile / Scrum Methodology' },
        { value: 'stakeholder_mgmt', label: 'Stakeholder Communication' },
        { value: 'project_tools', label: 'PM Tools (Jira, Trello, MS Project)' },
        { value: 'reporting', label: 'Progress Reporting & KPIs' },
        { value: 'resource_allocation', label: 'Resource Allocation' },
      ],
      motivationPlaceholder: 'Tell us what sparked your interest in project management... What types of projects do you want to lead?',
      learningOutcomesPlaceholder: 'E.g., Get PMP certified, lead cross-functional teams, improve delivery timelines, start a consulting practice...',
      careerImpactLabel: 'How will project management skills help your career or business?',
      careerImpactPlaceholder: 'Think about the real-world impact... Will it help you lead teams? Deliver projects on time? Get promoted? Start a PMO?',
      careerImpactHelperText: 'Connect project management to your professional growth',
    };
  }

  // ---------- Generic / Fallback for any other course ----------
  const displayName = courseTitle || 'this subject';
  return {
    subjectName: displayName,
    shortName: displayName.split(':')[0].split('–')[0].trim().substring(0, 30),
    sectionTitle: 'Subject Skills Assessment',
    sectionDesc: 'Current skill assessment',
    hasUsedQuestion: `Do you have prior experience with ${displayName}?`,
    skillLevelLabel: 'Your Current Skill Level',
    skillLevelPlaceholder: `How would you rate your current skill level in ${displayName}?`,
    skillLevels: [
      { value: 'never_used', label: 'No Prior Experience' },
      { value: 'beginner', label: 'Beginner (Familiar with basics)' },
      { value: 'intermediate', label: 'Intermediate (Some hands-on experience)' },
      { value: 'advanced', label: 'Advanced (Comfortable with complex tasks)' },
      { value: 'expert', label: 'Expert (Professional-level proficiency)' },
    ],
    tasksLabel: 'Which related tasks or activities have you done before?',
    tasks: [
      { value: 'basic_concepts', label: 'Basic Concepts & Fundamentals' },
      { value: 'hands_on_practice', label: 'Hands-on Practice & Exercises' },
      { value: 'small_projects', label: 'Completed Small Projects' },
      { value: 'online_courses', label: 'Taken Online Courses / Tutorials' },
      { value: 'certification', label: 'Earned a Related Certification' },
      { value: 'professional_use', label: 'Used Professionally at Work' },
      { value: 'taught_others', label: 'Taught or Mentored Others' },
      { value: 'self_study', label: 'Self-Study (Books, Videos)' },
      { value: 'community_participation', label: 'Participated in Communities / Forums' },
    ],
    motivationPlaceholder: `Tell us what sparked your interest in ${displayName}... Share your story, your challenges, and what drives you to learn.`,
    learningOutcomesPlaceholder: 'E.g., Gain certification, advance in career, start a business, build portfolio projects...',
    careerImpactLabel: `How will mastering ${displayName} help your career or business?`,
    careerImpactPlaceholder: 'Think about the real-world impact on your career, business, or personal goals...',
    careerImpactHelperText: 'Connect this skill to your professional growth',
  };
}

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
  // Restore section from draft on first render (lazy initializer)
  const [currentSection, setCurrentSection] = useState<number>(() => {
    if (typeof window === 'undefined') return 1;
    try {
      const raw = localStorage.getItem(`afritec_draft_application_${courseId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.currentSection >= 1 && parsed?.currentSection <= 7) return parsed.currentSection;
      }
    } catch { /* ignore */ }
    return 1;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [scores, setScores] = useState<any>(null);
  
  // Payment states
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'approved' | 'failed'>('pending');
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [stripeSessionId, setStripeSessionId] = useState<string | null>(null);
  const [bankTransferDetails, setBankTransferDetails] = useState<string | null>(null);
  // Informational message after bank transfer "I've Completed Payment"
  const [bankTransferInfo, setBankTransferInfo] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // MTN MoMo: real-time phone number validation
  const [momoValidation, setMomoValidation] = useState<{
    loading: boolean;
    valid: boolean | null;
    name: string | null;
    error: string | null;
  }>({ loading: false, valid: null, name: null, error: null });

  // MTN MoMo: auto-polling refs
  const momoPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const momoPollingCountRef = useRef(0);

  const searchParams = useSearchParams();

  // Restore payment status when returning from PayPal / Stripe redirect
  useEffect(() => {
    const verifiedParam = searchParams?.get('payment_verified');
    const verifiedKey = `payment_verified_for_course_${courseId}`;
    const stored = typeof window !== 'undefined' ? localStorage.getItem(verifiedKey) : null;

    if (verifiedParam === 'true' || stored === 'true') {
      setPaymentStatus('approved');
      // Restore saved draft ID so the submit handler can upsert the draft record
      if (typeof window !== 'undefined') {
        const storedDraftId = localStorage.getItem(`draft_id_for_course_${courseId}`);
        if (storedDraftId) setSavedDraftId(Number(storedDraftId));
      }
      // Jump to the payment section so the student can review and submit
      setCurrentSection(7);
      // Consume the flag so refreshing the page doesn't keep it approved
      if (typeof window !== 'undefined') {
        localStorage.removeItem(verifiedKey);
        localStorage.removeItem(`payment_reference_for_course_${courseId}`);
        localStorage.removeItem(`payment_method_for_course_${courseId}`);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set default payment method to the first enabled method when course data loads.
  // Runs whenever courseData changes so it always reflects current course settings.
  useEffect(() => {
    const requiresPayment =
      courseData?.enrollment_type === 'paid' || courseData?.require_payment_before_application;
    if (!requiresPayment || !courseData) return;

    // Use payment_summary.enabled_methods (authoritative server-side list) or
    // fall back to the payment_methods array serialised in the course object.
    const enabledMethods: string[] =
      (courseData.payment_summary?.enabled_methods && courseData.payment_summary.enabled_methods.length > 0)
        ? courseData.payment_summary.enabled_methods
        : (courseData.payment_methods && courseData.payment_methods.length > 0
            ? courseData.payment_methods
            : ['kpay']);

    // Reset to first available method if the currently selected one is not enabled
    if (!enabledMethods.includes(formData.payment_method as string)) {
      handleInputChange('payment_method', enabledMethods[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseData]);
  
  // Duplicate check states
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [existingApplication, setExistingApplication] = useState<any>(null);
  const [emailChecked, setEmailChecked] = useState(false);

  // ── Auto-save: key is scoped per course ──
  const DRAFT_KEY = `afritec_draft_application_${courseId}`;

  // Helper: read a stored draft synchronously (safe for SSR)
  const readStoredDraft = (): { formData: Partial<ApplicationSubmitData>; currentSection: number; savedAt?: string } | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.formData) return parsed;
    } catch { /* ignore */ }
    return null;
  };

  const defaultFormData: ApplicationSubmitData = {
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
    payment_method: 'kpay',
    payment_phone_number: '',
    payment_payer_name: '',
    paypal_email: '',
  };

  // Lazy initializers: read from localStorage on very first render so
  // the form is pre-filled before any effect runs (avoids race condition).
  const [formData, setFormData] = useState<ApplicationSubmitData>(() => {
    const draft = readStoredDraft();
    if (!draft) return defaultFormData;
    return { ...defaultFormData, ...draft.formData, course_id: courseId };
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Banner: shown when a draft was found and pre-loaded on mount
  const [showDraftBanner, setShowDraftBanner] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return Boolean(localStorage.getItem(DRAFT_KEY)); } catch { return false; }
  });
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(() => {
    const draft = readStoredDraft();
    return draft?.savedAt ? new Date(draft.savedAt) : null;
  });

  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
  const [autoSaveLastSaved, setAutoSaveLastSaved] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks if we're in the initial mount tick to skip saving the just-loaded draft
  const initialMountRef = useRef(true);

  // ── Payment-as-next-step flow ────────────────────────────────────────────
  // True when this course requires payment (paid enrollment or require_payment_before_application)
  const requiresPaymentStep =
    courseData?.enrollment_type === 'paid' || courseData?.require_payment_before_application === true;
  // Total form sections: 6 for free/scholarship, 7 for courses requiring payment
  const totalSections = requiresPaymentStep ? 7 : 6;

  // Persisted draft ID returned by /save-draft (needed to upsert on final submit)
  const [savedDraftId, setSavedDraftId] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(`draft_id_for_course_${courseId}`);
      return raw ? Number(raw) : null;
    } catch { return null; }
  });
  const [savingDraft, setSavingDraft] = useState(false);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (autoSaveIdleTimerRef.current) clearTimeout(autoSaveIdleTimerRef.current);
    };
  }, []);

  // Mark initial mount as done after first render (skip saving the pre-loaded state)
  useEffect(() => {
    const t = setTimeout(() => { initialMountRef.current = false; }, 100);
    return () => clearTimeout(t);
  }, []);

  // Debounced save whenever formData or currentSection changes
  useEffect(() => {
    if (initialMountRef.current) return; // skip saving pre-loaded draft data
    if (success) return; // don't save after a successful submit
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      try {
        setAutoSaveStatus('saving');
        const draft = { formData, currentSection, savedAt: new Date().toISOString() };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        const now = new Date();
        setAutoSaveLastSaved(now);
        setAutoSaveStatus('saved');
        if (autoSaveIdleTimerRef.current) clearTimeout(autoSaveIdleTimerRef.current);
        autoSaveIdleTimerRef.current = setTimeout(() => setAutoSaveStatus('idle'), 3000);
      } catch {
        setAutoSaveStatus('error');
      }
    }, 1500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, currentSection]);

  // "Restore" now just dismisses the banner — data is already in state
  const handleRestoreDraft = () => {
    setShowDraftBanner(false);
  };

  // "Start Over" clears the draft and resets the form to blank
  const handleDiscardDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    setFormData(defaultFormData);
    setCurrentSection(1);
    setShowDraftBanner(false);
  };

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
      // Full name: required, min 3 chars (nullable=False in DB)
      if (!formData.full_name.trim()) {
        errors.full_name = 'Full name is required';
      } else if (formData.full_name.trim().length < 3) {
        errors.full_name = 'Full name must be at least 3 characters';
      }

      // Email: required, valid format (nullable=False in DB)
      if (!formData.email.trim()) {
        errors.email = 'Email address is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.email = 'Please enter a valid email address';
      }

      // Phone: required, must include country code (nullable=False in DB)
      if (!formData.phone.trim()) {
        errors.phone = 'Phone number is required';
      } else if (!/^\+[1-9]\d{6,19}$/.test(formData.phone.replace(/[\s\-()]/g, ''))) {
        errors.phone = 'Please include your country code (e.g. +234-801-234-5678)';
      }

      // Gender: nullable=True in DB but required for scoring
      if (!formData.gender) errors.gender = 'Please select your gender';

      // Age range: nullable=True in DB but required for scoring
      if (!formData.age_range) errors.age_range = 'Please select your age range';

      // Country: nullable=True in DB but required for location-based decisions
      if (!formData.country?.trim()) errors.country = 'Country is required';
    }

    if (section === 2) {
      // nullable=True in DB but required for background scoring
      if (!formData.education_level) errors.education_level = 'Please select your education level';
      if (!formData.current_status) errors.current_status = 'Please select your current status';
    }

    if (section === 3) {
      // Conditional: if they've used the skill before, they must rate their level
      if (formData.has_used_excel && !formData.excel_skill_level) {
        errors.excel_skill_level = 'Please select your skill level';
      }
    }

    if (section === 4) {
      // Motivation: nullable=False in DB, min 50 chars
      if (!formData.motivation.trim()) {
        errors.motivation = 'Please tell us why you want to join this course';
      } else if (formData.motivation.trim().length < 50) {
        errors.motivation = `Please write at least 50 characters (currently ${formData.motivation.trim().length})`;
      }
      // Learning outcomes: nullable=True in DB but strongly encouraged
      if (!formData.learning_outcomes?.trim()) {
        errors.learning_outcomes = 'Please describe what you hope to achieve';
      }
    }

    if (section === 5) {
      // has_computer defaults to false — both true/false are valid answers, no validation needed
      // internet_access_type: nullable=True but required for logistics planning
      if (!formData.internet_access_type) {
        errors.internet_access_type = 'Please indicate your type of internet access';
      }
      // available_time: nullable=True but required to plan course delivery
      if (!formData.available_time || formData.available_time.length === 0) {
        errors.available_time = 'Please select at least one available time slot';
      }
    }

    if (section === 6) {
      // Both commitment fields are required before proceeding to payment
      if (!formData.committed_to_complete) {
        errors.committed_to_complete = 'You must commit to completing the course';
      }
      if (!formData.agrees_to_assessments) {
        errors.agrees_to_assessments = 'You must agree to participate in assessments';
      }
    }

    if (section === 7) {
      // Payment section validation — only reached for paid/require_payment courses
      const needsPayment = courseData?.enrollment_type === 'paid' || courseData?.require_payment_before_application;
      if (needsPayment) {
        if (formData.payment_method === 'mobile_money' && !formData.payment_phone_number?.trim()) {
          errors.payment_phone_number = 'Mobile money number is required for payment';
        }
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // MTN MoMo: validate phone number is an active MoMo account holder
  const validateMomoPhone = async (phone: string) => {
    const cleaned = phone?.trim();
    if (!cleaned || cleaned.length < 8) return;
    setMomoValidation({ loading: true, valid: null, name: null, error: null });
    try {
      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/applications/validate-momo-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: cleaned }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setMomoValidation({ loading: false, valid: false, name: null, error: data.error || 'Validation failed' });
        return;
      }
      setMomoValidation({
        loading: false,
        valid: data.valid,
        name: data.name || null,
        error: null,
      });
      // Auto-fill payer name from MoMo account if field is empty
      if (data.name && !formData.payment_payer_name?.trim()) {
        handleInputChange('payment_payer_name', data.name);
      }
    } catch {
      setMomoValidation({ loading: false, valid: null, name: null, error: 'Could not reach MoMo validation service' });
    }
  };

  // MTN MoMo: auto-poll payment status every 5 s while processing (up to 2 min / 24 polls)
  useEffect(() => {
    if (paymentStatus === 'processing' && formData.payment_method === 'mobile_money' && paymentReference) {
      momoPollingCountRef.current = 0;
      const poll = async () => {
        if (momoPollingCountRef.current >= 24) {
          if (momoPollingRef.current) clearInterval(momoPollingRef.current);
          return;
        }
        momoPollingCountRef.current += 1;
        try {
          const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/applications/verify-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payment_method: 'mobile_money', reference: paymentReference }),
          });
          const data = await resp.json();
          if (data.status === 'completed' || data.status === 'successful') {
            setPaymentStatus('approved');
            if (momoPollingRef.current) clearInterval(momoPollingRef.current);
          } else if (data.status === 'failed') {
            setPaymentStatus('failed');
            if (momoPollingRef.current) clearInterval(momoPollingRef.current);
          }
        } catch { /* ignore transient polling errors */ }
      };
      momoPollingRef.current = setInterval(poll, 5000);
      return () => {
        if (momoPollingRef.current) clearInterval(momoPollingRef.current);
      };
    } else {
      if (momoPollingRef.current) {
        clearInterval(momoPollingRef.current);
        momoPollingRef.current = null;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentStatus, formData.payment_method, paymentReference]);

  // Handle payment initiation
  const handlePayNow = async () => {
    // Validate payment fields first (section 7 covers MoMo phone number etc.)
    if (!validateSection(7)) return;

    const needsPayment = courseData?.enrollment_type === 'paid' || courseData?.require_payment_before_application;
    if (!needsPayment) return;

    setPaymentLoading(true);
    setError(null);

    // ── Determine the correct amount to charge based on payment mode ──
    const paymentMode = courseData?.payment_mode || 'full';
    const fullPrice = courseData?.price ?? 0;
    // payment_summary is the backend-authoritative breakdown for ALL payment modes
    const ps = courseData?.payment_summary;
    let amountDue: number;
    if (ps?.amount_due_now != null) {
      // Best case: backend-computed amount (works for full, partial, installment)
      amountDue = ps.amount_due_now;
    } else if (paymentMode === 'partial') {
      // Fallback for partial when payment_summary is unavailable
      if (courseData?.partial_payment_amount != null) {
        amountDue = courseData.partial_payment_amount;
      } else if (courseData?.partial_payment_percentage != null && fullPrice > 0) {
        amountDue = Math.round(fullPrice * courseData.partial_payment_percentage / 100 * 100) / 100;
      } else {
        amountDue = fullPrice;
      }
    } else {
      amountDue = fullPrice;
    }

    const currency = courseData?.currency || 'USD';
    const method = formData.payment_method as string;

    try {
      // Build base payload
      const basePayload: Record<string, unknown> = {
        course_id: courseId,
        amount: amountDue,
        currency,
        payment_method: method,
        email: formData.email,
        payment_mode: paymentMode,
      };

      if (method === 'mobile_money') {
        basePayload.phone_number = formData.payment_phone_number || formData.phone;
        basePayload.payer_name = formData.payment_payer_name || formData.full_name;
      } else if (method === 'paypal' || method === 'stripe') {
        basePayload.return_url = `${window.location.origin}/payment/success?course_id=${courseId}`;
        basePayload.cancel_url = `${window.location.origin}/payment/cancel?course_id=${courseId}`;
      } else if (method === 'kpay') {
        basePayload.phone_number = formData.payment_phone_number || formData.phone || '';
        basePayload.payer_name = formData.payment_payer_name || formData.full_name || '';
        basePayload.return_url = `${window.location.origin}/payment/success?course_id=${courseId}`;
        // kpay_pmethod: default to momo; could be extended to let user choose cc/spenn
        basePayload.kpay_pmethod = 'momo';
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/applications/initiate-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(basePayload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment initiation failed');
      }

      if (method === 'mobile_money') {
        setPaymentReference(data.reference);
        setPaymentStatus('processing');
        // If backend returned a payer name from MoMo profile, auto-fill the name field
        if (data.payer_name && !formData.payment_payer_name?.trim()) {
          handleInputChange('payment_payer_name', data.payer_name);
        }
      } else if (method === 'paypal') {
        const approvalUrl = data.approval_url;
        if (approvalUrl) {
          localStorage.setItem('pending_application_form', JSON.stringify({ formData, courseId, courseTitle }));
          localStorage.setItem('paypal_order_id', data.order_id);
          window.location.href = approvalUrl;
          return;
        }
        throw new Error('PayPal did not return an approval URL');
      } else if (method === 'stripe') {
        const checkoutUrl = data.checkout_url;
        if (checkoutUrl) {
          localStorage.setItem('pending_application_form', JSON.stringify({ formData, courseId, courseTitle }));
          localStorage.setItem('stripe_session_id', data.session_id);
          window.location.href = checkoutUrl;
          return;
        }
        throw new Error('Stripe did not return a checkout URL');
      } else if (method === 'kpay') {
        const checkoutUrl = data.checkout_url;
        if (checkoutUrl) {
          localStorage.setItem('pending_application_form', JSON.stringify({ formData, courseId, courseTitle }));
          localStorage.setItem('kpay_reference', data.reference || '');
          localStorage.setItem('kpay_tid', data.tid || '');
          window.location.href = checkoutUrl;
          return;
        }
        throw new Error('K-Pay did not return a checkout URL');
      } else if (method === 'bank_transfer') {
        // Bank transfer: use backend-confirmed reference, combine with course bank details
        setBankTransferDetails(
          data.bank_details || courseData?.bank_transfer_details || null
        );
        setPaymentReference(data.reference);
        setPaymentStatus('processing');
        setBankTransferInfo(null);
      }
    } catch (err: any) {
      setError(err.message || 'Payment initiation failed');
      setPaymentStatus('failed');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Handle payment confirmation (for mobile money after user approves on phone, or bank transfer)
  const handleConfirmPayment = async () => {
    if (!paymentReference) return;

    const method = formData.payment_method as string;

    // Bank transfer cannot be verified via API – inform user and allow submission
    if (method === 'bank_transfer') {
      setBankTransferInfo(
        `Your payment reference is: ${paymentReference}. ` +
        'Our team will verify your bank transfer and confirm your enrollment. ' +
        'You can now submit your application — we will contact you once payment is confirmed.'
      );
      setError(null);
      setPaymentStatus('approved');
      return;
    }

    setPaymentLoading(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/applications/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: method,
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

  // Save application to DB and advance to the payment step (section 7)
  const handleSaveAndProceedToPayment = async () => {
    // Validate section 6 (commitment & referral) first
    if (!validateSection(6)) {
      setTimeout(() => {
        document.getElementById('section-error-banner')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return;
    }

    setSavingDraft(true);
    setError(null);

    try {
      const result = await applicationService.saveDraft({ ...formData });
      setSavedDraftId(result.application_id);
      // Persist so PayPal/Stripe redirects can recover the draft ID
      try { localStorage.setItem(`draft_id_for_course_${courseId}`, String(result.application_id)); } catch { /* ignore */ }
      // Advance to the payment step
      setCurrentSection(7);
      document.getElementById('application-form-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to save application. Please try again.';
      setError(msg);
    } finally {
      setSavingDraft(false);
    }
  };

  const handleNext = () => {
    // Don't allow proceeding if email already exists
    if (currentSection === 1 && existingApplication) {
      return;
    }

    if (validateSection(currentSection)) {
      setCurrentSection((prev) => Math.min(prev + 1, totalSections));
      setError(null); // Clear any errors when moving to next section
      // Scroll to top of form on section advance
      document.getElementById('application-form-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Scroll to error summary banner so user sees what's missing
      setTimeout(() => {
        document.getElementById('section-error-banner')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
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
    const requiresPayment = courseData?.enrollment_type === 'paid';
    const requireBeforeApp = courseData?.require_payment_before_application;
    if ((requiresPayment || requireBeforeApp) && paymentStatus !== 'approved') {
      setError('Please complete payment before submitting your application.');
      return;
    }
    
    if (!validateSection(requiresPaymentStep ? 7 : 6)) return;

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

      // Always pass payment tracking fields to the backend so it can store them
      const needsPaymentTracking = courseData?.enrollment_type === 'paid' || courseData?.require_payment_before_application;
      if (needsPaymentTracking && paymentReference) {
        (payload as any).payment_reference = paymentReference;
        (payload as any).payment_status = paymentStatus === 'approved' ? 'approved' : paymentStatus;
      }
      // Include payment method for bank transfer even when require_payment_before_application
      if (needsPaymentTracking) {
        (payload as any).payment_method = formData.payment_method;
      }

      if (!needsPaymentTracking) {
        delete payload.payment_method;
        delete payload.payment_phone_number;
        delete payload.payment_payer_name;
        delete payload.paypal_email;
      }

      // If the application was pre-saved as a draft, pass draft_id so the backend upserts it
      if (savedDraftId) {
        (payload as any).draft_id = savedDraftId;
      }

      const response = await applicationService.submitApplication(payload);
      
      if (response && response.application_id) {
        // Payment already completed before submission, no need to redirect
        setSuccess(true);
        setApplicationId(response.application_id);
        setScores(response.scores);
        // Clear draft on successful submission
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
        try { localStorage.removeItem(`draft_id_for_course_${courseId}`); } catch { /* ignore */ }
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
        return renderSkillAssessment();
      case 4:
        return renderLearningGoals();
      case 5:
        return renderAccessAvailability();
      case 6:
        return renderCommitment();
      case 7:
        return renderPaymentStep();
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
          onBlur={() => {
            const val = formData.full_name.trim();
            if (!val) {
              setValidationErrors((prev) => ({ ...prev, full_name: 'Full name is required' }));
            } else if (val.length < 3) {
              setValidationErrors((prev) => ({ ...prev, full_name: 'Full name must be at least 3 characters' }));
            } else {
              setValidationErrors((prev) => { const n = { ...prev }; delete n.full_name; return n; });
            }
          }}
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
          onBlur={() => {
            const val = formData.phone.trim();
            if (!val) {
              setValidationErrors((prev) => ({ ...prev, phone: 'Phone number is required' }));
            } else if (!/^\+[1-9]\d{6,19}$/.test(val.replace(/[\s\-()]/g, ''))) {
              setValidationErrors((prev) => ({ ...prev, phone: 'Please include your country code (e.g. +234-801-234-5678)' }));
            } else {
              setValidationErrors((prev) => { const n = { ...prev }; delete n.phone; return n; });
            }
          }}
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
            Gender <span className="text-red-600">*</span>
          </Label>
          <Select
            value={formData.gender}
            onValueChange={(value) => handleInputChange('gender', value)}
          >
            <SelectTrigger id="gender" className={`py-6 text-base border-2 rounded-xl focus:ring-2 text-gray-900 ${
              validationErrors.gender
                ? 'border-red-500 bg-red-50/50 focus:border-red-600 focus:ring-red-200'
                : 'border-gray-300 focus:border-purple-600 focus:ring-purple-200'
            }`}>
              <SelectValue placeholder="Please select your gender" className="text-gray-900" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
              <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
          {validationErrors.gender && (
            <p className="text-sm text-red-600 mt-2 font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {validationErrors.gender}
            </p>
          )}
        </div>

        {/* Age Range Select */}
        <div>
          <Label htmlFor="age_range" className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Age Range <span className="text-red-600">*</span>
          </Label>
          <Select
            value={formData.age_range}
            onValueChange={(value) => handleInputChange('age_range', value)}
          >
            <SelectTrigger id="age_range" className={`py-6 text-base border-2 rounded-xl focus:ring-2 text-gray-900 ${
              validationErrors.age_range
                ? 'border-red-500 bg-red-50/50 focus:border-red-600 focus:ring-red-200'
                : 'border-gray-300 focus:border-blue-600 focus:ring-blue-200'
            }`}>
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
          {validationErrors.age_range && (
            <p className="text-sm text-red-600 mt-2 font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {validationErrors.age_range}
            </p>
          )}
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
            Country <span className="text-red-600">*</span>
          </Label>
          <Input
            id="country"
            value={formData.country}
            onChange={(e) => handleInputChange('country', e.target.value)}
            placeholder="Which country are you applying from?"
            className={`py-6 text-base text-gray-900 placeholder:text-gray-500 rounded-xl transition-all duration-300 ${
              validationErrors.country
                ? 'border-red-500 bg-red-50/50 focus-visible:border-red-600 focus-visible:ring-red-200'
                : 'bg-white focus-visible:border-emerald-500 focus-visible:ring-emerald-200'
            }`}
          />
          <p className="text-sm text-gray-700 mt-2 ml-1">
            We prioritize applicants from African countries.
          </p>
          {validationErrors.country && (
            <p className="text-sm text-red-600 mt-2 font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {validationErrors.country}
            </p>
          )}
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
          Highest Level of Education <span className="text-red-600">*</span>
        </Label>
        <Select
          value={formData.education_level}
          onValueChange={(value) => handleInputChange('education_level', value)}
        >
          <SelectTrigger id="education_level" className={`py-6 text-base border-2 rounded-xl focus:ring-2 text-gray-900 ${
            validationErrors.education_level
              ? 'border-red-500 bg-red-50/50 focus:border-red-600 focus:ring-red-200'
              : 'border-gray-300 focus:border-indigo-600 focus:ring-indigo-200'
          }`}>
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
        {validationErrors.education_level && (
          <p className="text-sm text-red-600 mt-2 font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {validationErrors.education_level}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="current_status" className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
          <Briefcase className="w-5 h-5 text-blue-600" />
          Current Status <span className="text-red-600">*</span>
        </Label>
        <Select
          value={formData.current_status}
          onValueChange={(value) => handleInputChange('current_status', value)}
        >
          <SelectTrigger id="current_status" className={`py-6 text-base border-2 rounded-xl focus:ring-2 text-gray-900 ${
            validationErrors.current_status
              ? 'border-red-500 bg-red-50/50 focus:border-red-600 focus:ring-red-200'
              : 'border-gray-300 focus:border-blue-600 focus:ring-blue-200'
          }`}>
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
        {validationErrors.current_status && (
          <p className="text-sm text-red-600 mt-2 font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {validationErrors.current_status}
          </p>
        )}
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

  const skillConfig = getCourseSkillConfig(courseTitle || courseData?.title);

  const renderSkillAssessment = () => (
    <div className="space-y-6">
      <div className="bg-emerald-50 border-l-4 border-emerald-600 p-6 rounded-r-xl">
        <Label className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Monitor className="w-6 h-6 text-emerald-600" />
          {skillConfig.hasUsedQuestion}
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
          {skillConfig.skillLevelLabel}
        </Label>
        <Select
          value={formData.excel_skill_level}
          onValueChange={(value) => handleInputChange('excel_skill_level', value)}
        >
          <SelectTrigger id="excel_skill_level" className={`py-6 text-base border-2 rounded-xl focus:ring-2 text-gray-900 ${
            validationErrors.excel_skill_level
              ? 'border-red-500 bg-red-50/50 focus:border-red-600 focus:ring-red-200'
              : 'border-gray-300 focus:border-emerald-600 focus:ring-emerald-200'
          }`}>
            <SelectValue placeholder={skillConfig.skillLevelPlaceholder} className="text-gray-900" />
          </SelectTrigger>
          <SelectContent>
            {skillConfig.skillLevels.map((level) => (
              <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-gray-600 mt-2 ml-1 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          Be honest! This helps us place you in the right group.
        </p>
        {validationErrors.excel_skill_level && (
          <p className="text-sm text-red-600 mt-2 font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {validationErrors.excel_skill_level}
          </p>
        )}
      </div>

      {formData.has_used_excel && (
        <div className="bg-blue-50 border-2 border-blue-300 p-6 rounded-2xl">
          <Label className="text-base font-bold text-gray-900 flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
            {skillConfig.tasksLabel}
          </Label>
          <p className="text-sm text-gray-700 mb-4">Select all that apply</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {skillConfig.tasks.map((task) => (
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
          onBlur={() => {
            const val = formData.motivation.trim();
            if (!val) {
              setValidationErrors((prev) => ({ ...prev, motivation: 'Please tell us why you want to join this course' }));
            } else if (val.length < 50) {
              setValidationErrors((prev) => ({ ...prev, motivation: `Please write at least 50 characters (currently ${val.length})` }));
            } else {
              setValidationErrors((prev) => { const n = { ...prev }; delete n.motivation; return n; });
            }
          }}
          placeholder={skillConfig.motivationPlaceholder}
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
          What do you want to achieve after completing this course? <span className="text-red-600">*</span>
        </Label>
        <Textarea
          id="learning_outcomes"
          value={formData.learning_outcomes}
          onChange={(e) => handleInputChange('learning_outcomes', e.target.value)}
          placeholder={skillConfig.learningOutcomesPlaceholder}
          rows={4}
          className={`text-base text-gray-900 placeholder:text-gray-500 rounded-xl transition-all duration-300 resize-none ${
            validationErrors.learning_outcomes
              ? 'border-red-500 bg-red-50/50 focus-visible:border-red-600 focus-visible:ring-red-200'
              : 'bg-white focus-visible:border-amber-500 focus-visible:ring-amber-200'
          }`}
        />
        <p className="text-sm text-gray-700 mt-2 ml-1">
          Your specific learning outcomes and goals
        </p>
        {validationErrors.learning_outcomes && (
          <p className="text-sm text-red-600 mt-2 font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {validationErrors.learning_outcomes}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="career_impact" className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          {skillConfig.careerImpactLabel}
        </Label>
        <Textarea
          id="career_impact"
          value={formData.career_impact}
          onChange={(e) => handleInputChange('career_impact', e.target.value)}
          placeholder={skillConfig.careerImpactPlaceholder}
          rows={4}
          className="text-base text-gray-900 placeholder:text-gray-500 bg-white rounded-xl focus-visible:border-blue-500 focus-visible:ring-blue-200 transition-all duration-300 resize-none"
        />
        <p className="text-sm text-gray-700 mt-2 ml-1">
          {skillConfig.careerImpactHelperText}
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
          Internet Access Type <span className="text-red-600">*</span>
        </Label>
        <Select
          value={formData.internet_access_type}
          onValueChange={(value) => handleInputChange('internet_access_type', value)}
        >
          <SelectTrigger id="internet_access_type" className={`py-6 text-base border-2 rounded-xl focus:ring-2 text-gray-900 ${
            validationErrors.internet_access_type
              ? 'border-red-500 bg-red-50/50 focus:border-red-600 focus:ring-red-200'
              : 'border-gray-300 focus:border-cyan-600 focus:ring-cyan-200'
          }`}>
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
        {validationErrors.internet_access_type && (
          <p className="text-sm text-red-600 mt-2 font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {validationErrors.internet_access_type}
          </p>
        )}
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

      <div id="available_time" className={`bg-blue-50 border-2 rounded-2xl p-6 ${
        validationErrors.available_time ? 'border-red-400 bg-red-50/30' : 'border-blue-300'
      }`}>
        <Label className="text-base font-bold text-gray-900 flex items-center gap-2 mb-3">
          <Clock className="w-6 h-6 text-blue-600" />
          Available Time for Learning <span className="text-red-600">*</span>
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
        {validationErrors.available_time && (
          <p className="text-sm text-red-600 mt-3 font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {validationErrors.available_time}
          </p>
        )}
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

      {/* Payment Next Step Preview — only shown for paid / require_payment courses */}
      {requiresPaymentStep && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-300 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-indigo-600 rounded-xl">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-base font-bold text-gray-900">Next Step: Complete Payment</p>
              <p className="text-sm text-gray-600 mt-0.5">
                {courseData?.require_payment_before_application
                  ? 'Payment must be completed before your application is submitted.'
                  : 'Payment will be collected on the next screen after you save this form.'}
              </p>
            </div>
          </div>
          {(() => {
            const cur = courseData?.currency || 'USD';
            const ps = courseData?.payment_summary;
            const full = courseData?.price ?? 0;
            const pm = courseData?.payment_mode || 'full';
            const due = ps?.amount_due_now != null
              ? ps.amount_due_now
              : pm === 'partial'
                ? (courseData?.partial_payment_amount ?? (courseData?.partial_payment_percentage != null && full > 0
                    ? Math.round(full * courseData.partial_payment_percentage / 100 * 100) / 100 : full))
                : full;
            if (due <= 0) return null;
            return (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="inline-flex items-center gap-2 bg-white border-2 border-indigo-300 text-indigo-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm">
                  <CreditCard className="w-4 h-4" />
                  Amount due: {cur} {due.toLocaleString()}
                  {pm === 'partial' && <span className="text-xs font-normal text-indigo-500">(your contribution)</span>}
                </div>
                {(courseData?.payment_methods || []).length > 0 && (
                  <span className="text-xs text-gray-500">
                    Accepted: {(courseData?.payment_methods || []).join(', ')}
                  </span>
                )}
              </div>
            );
          })()}
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

  // ─── renderPaymentStep ────────────────────────────────────────────────────
  const renderPaymentStep = () => {
    const paymentMode = courseData?.payment_mode || 'full';
    const currency = courseData?.currency || 'USD';
    const fullPrice = courseData?.price ?? 0;
    const ps = courseData?.payment_summary;
    const amountDue: number = ps?.amount_due_now != null
      ? ps.amount_due_now
      : paymentMode === 'partial'
        ? (courseData?.partial_payment_amount
            ?? (courseData?.partial_payment_percentage != null && fullPrice > 0
              ? Math.round(fullPrice * courseData.partial_payment_percentage / 100 * 100) / 100
              : fullPrice))
        : fullPrice;
    const remainingBalance: number | null = ps?.remaining_balance != null
      ? ps.remaining_balance
      : (paymentMode === 'partial' && fullPrice > 0 && amountDue > 0
        ? Math.round((fullPrice - amountDue) * 100) / 100
        : null);

    const enabledMethods: string[] =
      (courseData?.payment_summary?.enabled_methods && courseData.payment_summary.enabled_methods.length > 0)
        ? courseData.payment_summary.enabled_methods
        : (courseData?.payment_methods && courseData.payment_methods.length > 0
            ? courseData.payment_methods
            : ['kpay']);
    const methodLabels: Record<string, { label: string; sub: string; color: string }> = {
      kpay: { label: 'K-Pay', sub: 'MTN / Airtel MoMo, Visa, Mastercard, SPENN', color: 'violet' },
      paypal: { label: 'PayPal', sub: 'Credit/debit card or PayPal balance', color: 'blue' },
      mobile_money: { label: 'MTN Mobile Money', sub: 'Mobile wallet (Africa)', color: 'amber' },
      stripe: { label: 'Card (Stripe)', sub: 'Visa, Mastercard, Amex via Stripe', color: 'indigo' },
      bank_transfer: { label: 'Bank Transfer', sub: 'Manual wire transfer', color: 'emerald' },
    };

    return (
      <div className="space-y-8">
        {/* Step header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 bg-indigo-600 text-white px-6 py-3 rounded-2xl shadow-lg mb-4">
            <CreditCard className="w-6 h-6" />
            <span className="text-lg font-bold">Complete Your Payment</span>
          </div>
          <p className="text-gray-600 max-w-lg mx-auto">
            {courseData?.require_payment_before_application
              ? 'Payment is required before your application is reviewed.'
              : 'Complete payment to finalise your application.'}
          </p>
        </div>

        {/* Amount breakdown */}
        <div className={`bg-indigo-50 border-2 border-indigo-300 p-6 rounded-2xl shadow-sm`}>
          <div className="flex items-center gap-3 mb-5">
            <div className={`p-2 rounded-lg ${paymentMode === 'partial' ? 'bg-purple-600' : 'bg-indigo-600'}`}>
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-lg font-bold text-gray-900">
                  {paymentMode === 'partial' ? 'Partial Scholarship — Your Contribution' : 'Full Tuition — Payment Required'}
                </p>
                <CurrencySelector compact />
              </div>
              {courseData?.require_payment_before_application && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold border border-amber-300">
                  Must complete payment before applying
                </span>
              )}
            </div>
          </div>

          <div className={`grid gap-3 mb-5 ${paymentMode === 'partial' ? 'grid-cols-3' : 'grid-cols-1'}`}>
            <div className={`rounded-xl p-3 border ${paymentMode === 'partial' ? 'bg-purple-50 border-purple-200' : 'bg-indigo-50 border-indigo-200'}`}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                {paymentMode === 'partial' ? 'Your Contribution' : 'Tuition Fee'}
              </p>
              <p className="text-2xl font-bold text-indigo-700">
                {amountDue > 0 ? `${currency} ${amountDue.toLocaleString()}` : 'TBD'}
              </p>
              {amountDue > 0 && (
                <ConvertedBadge amount={amountDue} currency={currency} className="text-sm block mt-0.5" />
              )}
              {paymentMode === 'partial' && courseData?.partial_payment_percentage != null && (
                <p className="text-xs text-purple-500 mt-0.5">{courseData.partial_payment_percentage}% your contribution — rest covered by scholarship</p>
              )}
            </div>
            {paymentMode === 'partial' && (
              <>
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Covered by Scholarship</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {remainingBalance != null && remainingBalance > 0 ? `${currency} ${remainingBalance.toLocaleString()}` : '—'}
                  </p>
                  {remainingBalance != null && remainingBalance > 0 && (
                    <ConvertedBadge amount={remainingBalance} currency={currency} className="text-sm block" />
                  )}
                </div>
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Program Cost</p>
                  <p className="text-2xl font-bold text-gray-600">
                    {fullPrice > 0 ? `${currency} ${fullPrice.toLocaleString()}` : '—'}
                  </p>
                  {fullPrice > 0 && (
                    <ConvertedBadge amount={fullPrice} currency={currency} className="text-sm block" />
                  )}
                </div>
              </>
            )}
          </div>

          {/* Payment method selection */}
          <div className="mb-6">
            <Label className="text-base font-bold text-gray-900 mb-3 block">Select Payment Method</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {enabledMethods.map((method) => {
                const meta = methodLabels[method] || { label: method, sub: '', color: 'gray' };
                const selected = formData.payment_method === method;
                return (
                  <div
                    key={method}
                    onClick={() => handleInputChange('payment_method', method)}
                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 ${
                      selected
                        ? `border-${meta.color}-600 bg-${meta.color}-100 shadow-md`
                        : 'border-gray-300 bg-white hover:border-gray-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${selected ? `bg-${meta.color}-600` : 'bg-gray-200'}`}>
                        <CreditCard className={`w-5 h-5 ${selected ? 'text-white' : 'text-gray-600'}`} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{meta.label}</p>
                        <p className="text-xs text-gray-600">{meta.sub}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile Money */}
          {formData.payment_method === 'mobile_money' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
              <div className="space-y-2">
                <Label htmlFor="pp_payer_name" className="text-base font-bold text-gray-900">
                  Payer Name <span className="text-gray-500 font-normal">(optional)</span>
                </Label>
                <Input
                  id="pp_payer_name"
                  value={formData.payment_payer_name}
                  onChange={(e) => handleInputChange('payment_payer_name', e.target.value)}
                  placeholder="Enter name for payment"
                  className={`py-6 text-base border-2 rounded-xl focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 ${
                    momoValidation.name && formData.payment_payer_name === momoValidation.name
                      ? 'border-emerald-400'
                      : 'border-gray-300'
                  }`}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pp_phone" className="text-base font-bold text-gray-900">
                  Mobile Money Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="pp_phone"
                  value={formData.payment_phone_number}
                  onChange={(e) => {
                    handleInputChange('payment_phone_number', e.target.value);
                    setMomoValidation({ loading: false, valid: null, name: null, error: null });
                  }}
                  onBlur={(e) => validateMomoPhone(e.target.value)}
                  placeholder="e.g. +250700000000"
                  className={`py-6 text-base border-2 rounded-xl focus:ring-2 focus:ring-indigo-200 transition-colors ${
                    validationErrors.payment_phone_number
                      ? 'border-red-400 focus:border-red-500'
                      : momoValidation.valid === true
                      ? 'border-emerald-500 focus:border-emerald-600'
                      : momoValidation.valid === false
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-gray-300 focus:border-indigo-600'
                  }`}
                />
                {validationErrors.payment_phone_number && (
                  <p className="text-sm text-red-600 font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />{validationErrors.payment_phone_number}
                  </p>
                )}
                {!validationErrors.payment_phone_number && formData.payment_phone_number && (
                  <div className="mt-1">
                    {momoValidation.loading && (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Validating MoMo account…
                      </p>
                    )}
                    {!momoValidation.loading && momoValidation.valid === true && (
                      <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {momoValidation.name ? `Verified: ${momoValidation.name}` : 'Active MoMo account verified'}
                      </p>
                    )}
                    {!momoValidation.loading && momoValidation.valid === false && (
                      <p className="text-xs text-red-600 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {momoValidation.error || 'Not a registered MoMo account. Please check the number.'}
                      </p>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-600">We will send a payment prompt to this number.</p>
              </div>
            </div>
          )}

          {/* K-Pay */}
          {formData.payment_method === 'kpay' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="bg-violet-50 border border-violet-200 p-4 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-violet-600 rounded-lg"><CreditCard className="w-5 h-5 text-white" /></div>
                  <div>
                    <p className="font-bold text-gray-900">K-Pay Checkout</p>
                    <p className="text-sm text-gray-700 mt-1">
                      Click <strong>Pay Now</strong> to be redirected to the secure K-Pay checkout. Supports MTN Mobile Money, Airtel Money, Visa, Mastercard, and SPENN wallet.
                    </p>
                    <p className="text-sm text-gray-600 mt-2">Confirmation will be sent to: <span className="font-semibold">{formData.email}</span></p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="kpay_payer_name" className="text-base font-bold text-gray-900">
                    Full Name <span className="text-gray-500 font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="kpay_payer_name"
                    value={formData.payment_payer_name}
                    onChange={(e) => handleInputChange('payment_payer_name', e.target.value)}
                    placeholder="Your full name"
                    className="py-6 text-base border-2 rounded-xl border-gray-300 focus:border-violet-600 focus:ring-2 focus:ring-violet-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kpay_phone" className="text-base font-bold text-gray-900">
                    Phone Number <span className="text-gray-500 font-normal">(for MoMo)</span>
                  </Label>
                  <Input
                    id="kpay_phone"
                    value={formData.payment_phone_number}
                    onChange={(e) => handleInputChange('payment_phone_number', e.target.value)}
                    placeholder="e.g. +250700000000"
                    className="py-6 text-base border-2 rounded-xl border-gray-300 focus:border-violet-600 focus:ring-2 focus:ring-violet-200"
                  />
                  <p className="text-xs text-gray-500">Required for MTN/Airtel MoMo. Leave empty if paying by card or SPENN.</p>
                </div>
              </div>
            </div>
          )}

          {/* PayPal */}
          {formData.payment_method === 'paypal' && (            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl animate-in fade-in duration-300">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-600 rounded-lg"><CreditCard className="w-5 h-5 text-white" /></div>
                <div>
                  <p className="font-bold text-gray-900">PayPal Checkout</p>
                  <p className="text-sm text-gray-700 mt-1">
                    Click <strong>Pay Now</strong> to be redirected to PayPal. After completing payment, you will be returned here automatically.
                  </p>
                  <p className="text-sm text-gray-600 mt-2">Confirmation email will be sent to: <span className="font-semibold">{formData.email}</span></p>
                </div>
              </div>
            </div>
          )}

          {/* Stripe */}
          {formData.payment_method === 'stripe' && (
            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl animate-in fade-in duration-300">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-600 rounded-lg"><CreditCard className="w-5 h-5 text-white" /></div>
                <div>
                  <p className="font-bold text-gray-900">Secure Card Payment (Stripe)</p>
                  <p className="text-sm text-gray-700 mt-1">
                    Click <strong>Pay Now</strong> to open Stripe Checkout. Supports Visa, Mastercard, Amex, and more.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Bank Transfer */}
          {formData.payment_method === 'bank_transfer' && (() => {
            const bankDetailsText = bankTransferDetails || courseData?.bank_transfer_details || null;
            const copyToClipboard = (text: string, field: string) => {
              navigator.clipboard.writeText(text).then(() => {
                setCopiedField(field);
                setTimeout(() => setCopiedField(null), 2000);
              });
            };
            return (
              <div className="border border-emerald-200 rounded-xl overflow-hidden animate-in fade-in duration-300">
                <div className="bg-emerald-600 px-4 py-3 flex items-center gap-3">
                  <div className="p-1.5 bg-white/20 rounded-lg"><Building2 className="w-4 h-4 text-white" /></div>
                  <div>
                    <p className="font-bold text-white text-sm">Bank Transfer Payment</p>
                    <p className="text-emerald-100 text-xs">Direct deposit to bank account</p>
                  </div>
                </div>
                <div className="bg-emerald-50 p-4 space-y-4">
                  {bankDetailsText ? (
                    <>
                      <div className="bg-white rounded-lg border border-emerald-200 divide-y divide-emerald-100 overflow-hidden">
                        {bankDetailsText.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => {
                          const colonIdx = line.indexOf(':');
                          if (colonIdx > -1) {
                            const key = line.slice(0, colonIdx).trim();
                            const value = line.slice(colonIdx + 1).trim();
                            const isAccountNum = /account\s*number/i.test(key);
                            return (
                              <div key={i} className={`flex items-center justify-between px-3 py-2.5 ${isAccountNum ? 'bg-emerald-50' : ''}`}>
                                <div>
                                  <p className="text-xs text-gray-400 uppercase tracking-wide">{key}</p>
                                  <p className={`${isAccountNum ? 'font-mono text-base font-bold text-emerald-700 tracking-wider' : 'text-sm font-semibold text-gray-900'}`}>{value}</p>
                                </div>
                                {isAccountNum && (
                                  <button type="button" onClick={() => copyToClipboard(value, 'account')}
                                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-md transition-colors font-medium">
                                    {copiedField === 'account' ? <><Check className="w-3 h-3" />Copied!</> : <><Copy className="w-3 h-3" />Copy</>}
                                  </button>
                                )}
                              </div>
                            );
                          }
                          return <p key={i} className="text-sm text-gray-600 px-3 py-2">{line}</p>;
                        })}
                      </div>
                      {paymentReference ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide mb-1.5">Your Payment Reference</p>
                          <div className="flex items-center justify-between gap-2">
                            <code className="text-sm font-bold text-amber-800 break-all">{paymentReference}</code>
                            <button type="button" onClick={() => copyToClipboard(paymentReference, 'ref')}
                              className="flex-shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-md transition-colors font-medium">
                              {copiedField === 'ref' ? <><Check className="w-3 h-3" />Copied!</> : <><Copy className="w-3 h-3" />Copy</>}
                            </button>
                          </div>
                          <p className="text-xs text-amber-600 mt-1.5">Use this as the narration/reference when making your transfer.</p>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2.5 border border-gray-200">
                          Click <strong>Pay Now</strong> to generate your unique payment reference before transferring.
                        </p>
                      )}
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">How to complete payment:</p>
                        {['Copy the account number above','Log in to your bank app or visit a branch','Make a transfer for the exact course fee','Use your unique reference as the payment narration','Screenshot your receipt, then click "I’ve Completed Payment"'].map((step, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                            <p className="text-xs text-gray-600">{step}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <CreditCard className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-700">Click <strong>Pay Now</strong> to reveal bank account details and receive your unique payment reference.</p>
                    </div>
                  )}
                  {bankTransferInfo && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">{bankTransferInfo}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Payment status indicator */}
          {paymentStatus !== 'pending' && (
            <div className={`mt-4 p-4 rounded-xl border-2 animate-in fade-in duration-300 ${
              paymentStatus === 'approved' ? 'bg-emerald-50 border-emerald-500'
              : paymentStatus === 'processing' ? 'bg-amber-50 border-amber-500'
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
                    <Loader2 className="w-6 h-6 text-amber-600 animate-spin flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-bold text-amber-700">
                        {formData.payment_method === 'mobile_money' ? 'Waiting for your approval…' : 'Payment Processing'}
                      </p>
                      <p className="text-sm text-amber-600 mt-0.5">
                        {formData.payment_method === 'mobile_money'
                          ? 'A payment prompt has been sent to your phone. Open your MTN MoMo app or dial *182# and approve the request. This page will update automatically.'
                          : formData.payment_method === 'bank_transfer'
                          ? 'Please complete the bank transfer, then click "I\'ve Completed Payment" to proceed.'
                          : 'Waiting for payment confirmation…'}
                      </p>
                      {formData.payment_method === 'mobile_money' && (
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex gap-0.5">
                            {[0, 1, 2].map((i) => (
                              <span key={i} className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce"
                                style={{ animationDelay: `${i * 0.15}s` }} />
                            ))}
                          </div>
                          <span className="text-xs text-amber-500">Checking automatically every 5 seconds…</span>
                        </div>
                      )}
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
      </div>
    );
  };

  const sectionTitlesBase = [
    { num: 1, title: 'Applicant Information', desc: 'Tell us about yourself', icon: User },
    { num: 2, title: 'Education & Background', desc: 'Your professional journey', icon: GraduationCap },
    { num: 3, title: skillConfig.sectionTitle, desc: skillConfig.sectionDesc, icon: Monitor },
    { num: 4, title: 'Learning Goals', desc: 'Your vision for the future', icon: Target },
    { num: 5, title: 'Access & Availability', desc: 'Logistics for learning', icon: Clock },
    { num: 6, title: 'Commitment & Agreement', desc: 'Final commitment', icon: Award },
  ];
  const sectionTitles = requiresPaymentStep
    ? [...sectionTitlesBase, { num: 7, title: 'Payment', desc: 'Complete your payment', icon: CreditCard }]
    : sectionTitlesBase;

  // Calculate progress percentage
  const progressPercentage = (currentSection / totalSections) * 100;
  
  return (
    <div className="max-w-5xl mx-auto py-8 px-4" id="application-form-top">
      <Card className="shadow-xl border border-gray-200 bg-white overflow-hidden">
        <CardHeader className="border-b border-gray-200 bg-gray-50 pb-8">
          {/* Progress Bar with Animation */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3">
              <span className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                Section {currentSection} of {totalSections}
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
          <div className={`grid gap-3 mb-8 ${totalSections === 7 ? 'grid-cols-7' : 'grid-cols-6'}`}>
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
          {/* Draft Restore Banner */}
          {showDraftBanner && (
            <DraftRestoreBanner
              onRestore={handleRestoreDraft}
              onDiscard={handleDiscardDraft}
              className="mb-6"
              message={`✅ Your previous progress was restored${draftSavedAt ? ` (saved ${draftSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : ''}. You are on section ${currentSection} of ${totalSections}.`}
              restoreLabel="Keep Progress"
              discardLabel="Start Over"
            />
          )}

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
          {/* Section Validation Error Summary Banner */}
          {Object.keys(validationErrors).length > 0 && (() => {
            const fieldLabels: Record<string, string> = {
              full_name: 'Full Name',
              email: 'Email Address',
              phone: 'Phone Number',
              gender: 'Gender',
              age_range: 'Age Range',
              country: 'Country',
              education_level: 'Education Level',
              current_status: 'Current Status',
              excel_skill_level: 'Skill Level',
              motivation: 'Why do you want to join?',
              learning_outcomes: 'Learning Outcomes',
              internet_access_type: 'Internet Access Type',
              available_time: 'Available Time Slots',
              committed_to_complete: 'Course Commitment',
              agrees_to_assessments: 'Assessment Agreement',
              payment_phone_number: 'Mobile Money Number',
            };
            const errorFields = Object.keys(validationErrors);
            return (
              <div
                id="section-error-banner"
                className="mb-8 p-5 bg-red-50 border-2 border-red-400 rounded-2xl shadow-sm"
                role="alert"
                aria-live="polite"
              >
                <div className="flex items-start gap-3 mb-3">
                  <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-base font-bold text-red-900">
                      Please fix {errorFields.length} field{errorFields.length > 1 ? 's' : ''} before continuing
                    </p>
                    <p className="text-sm text-red-700 mt-0.5">Click a field name to jump to it</p>
                  </div>
                </div>
                <ul className="flex flex-wrap gap-2 ml-9">
                  {errorFields.map((field) => (
                    <li key={field}>
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById(field);
                          if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            el.focus();
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 text-sm font-semibold rounded-xl border border-red-300 transition-colors duration-200"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        {fieldLabels[field] || field}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}

          {renderSection()}

          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 mt-12 pt-8 border-t-2 border-gray-200">
            <AutoSaveIndicator status={autoSaveStatus} lastSaved={autoSaveLastSaved} className="hidden sm:flex self-center" />
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

            {currentSection < totalSections - (requiresPaymentStep ? 1 : 0) ? (
              /* Sections 1–5 for paid (1–5 for free): plain Next */
              <Button
                type="button"
                onClick={handleNext}
                className="px-10 py-6 text-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md hover:shadow-lg transition-all duration-300 rounded-xl"
              >
                Next Section
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            ) : currentSection === 6 && requiresPaymentStep ? (
              /* Section 6 of 7 (paid only): Save draft & proceed to payment */
              <Button
                type="button"
                onClick={handleSaveAndProceedToPayment}
                disabled={savingDraft || !!existingApplication}
                className="px-10 py-6 text-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md hover:shadow-lg transition-all duration-300 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {savingDraft ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Saving Application…
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5 mr-2" />
                    Save &amp; Proceed to Payment
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            ) : (
              /* Last section (section 6 for free, section 7 for paid): Pay + Submit */
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Pay Now / Confirm buttons — only on final section for paid courses */}
                {requiresPaymentStep && paymentStatus !== 'approved' && (
                  <>
                    {paymentStatus === 'processing' ? (
                      <Button
                        type="button"
                        onClick={handleConfirmPayment}
                        disabled={paymentLoading}
                        className="px-10 py-7 text-lg bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl"
                      >
                        {paymentLoading ? (
                          <><Loader2 className="w-6 h-6 mr-3 animate-spin" />Verifying Payment…</>
                        ) : formData.payment_method === 'mobile_money' ? (
                          <><CheckCircle2 className="w-6 h-6 mr-3" />Check Payment Status</>
                        ) : (
                          <><CheckCircle2 className="w-6 h-6 mr-3" />I&apos;ve Completed Payment</>
                        )}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={handlePayNow}
                        disabled={paymentLoading || !!existingApplication}
                        className="px-10 py-7 text-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl"
                      >
                        {paymentLoading ? (
                          <><Loader2 className="w-6 h-6 mr-3 animate-spin" />Initiating Payment…</>
                        ) : (
                          <>
                            <CreditCard className="w-6 h-6 mr-3" />
                            {(() => {
                              const pm = courseData?.payment_mode || 'full';
                              const cur = courseData?.currency || 'USD';
                              const full = courseData?.price ?? 0;
                              const psum = courseData?.payment_summary;
                              const due = psum?.amount_due_now != null
                                ? psum.amount_due_now
                                : pm === 'partial'
                                  ? (courseData?.partial_payment_amount
                                      ?? (courseData?.partial_payment_percentage != null && full > 0
                                        ? Math.round(full * courseData.partial_payment_percentage / 100 * 100) / 100
                                        : full))
                                  : full;
                              return `Pay ${pm === 'partial' ? 'My Contribution' : 'Now'} (${cur} ${due > 0 ? due.toLocaleString() : '—'})`;
                            })()}
                          </>
                        )}
                      </Button>
                    )}
                  </>
                )}

                {/* Payment approved badge */}
                {requiresPaymentStep && paymentStatus === 'approved' && (
                  <div className="flex items-center gap-2 px-6 py-4 bg-emerald-100 border-2 border-emerald-500 rounded-2xl">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    <span className="font-bold text-emerald-700">Payment Approved!</span>
                  </div>
                )}

                {/* Submit Application */}
                <Button
                  type="submit"
                  disabled={
                    loading ||
                    !!existingApplication ||
                    (requiresPaymentStep && paymentStatus !== 'approved')
                  }
                  className={`px-12 py-7 text-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed ${
                    requiresPaymentStep && paymentStatus !== 'approved'
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {loading ? (
                    <><Loader2 className="w-6 h-6 mr-3 animate-spin" />Submitting Application…</>
                  ) : existingApplication ? (
                    'Already Applied'
                  ) : requiresPaymentStep && paymentStatus !== 'approved' ? (
                    <><AlertCircle className="w-6 h-6 mr-3" />Pay First to Submit</>
                  ) : (
                    <><Sparkles className="w-6 h-6 mr-3" />Submit Application<CheckCircle2 className="w-6 h-6 ml-3" /></>
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