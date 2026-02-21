import { z } from 'zod';
import { ApiErrorHandler } from '@/lib/error-handler';

// ---------------------------------------------------------------------------
// Re-usable field validators
// ---------------------------------------------------------------------------

/** Accepts a non-empty, trimmed string */
const nonEmptyString = (min = 1, label = 'This field') =>
  z.string().min(min, `${label} is required`).trim();

/** Phone: accepts international E.164 and common local formats */
const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,14}$/;

/** Validates a URL allowing an empty string (optional fields) */
const optionalUrl = z.string().url('Please enter a valid URL').optional().or(z.literal(''));

/** Validates an email allowing an empty string (optional fields) */
const optionalEmail = z.string().email('Please enter a valid email').optional().or(z.literal(''));

/** ISO date that must be in the future */
const futureDateString = z.string().refine(
  (v) => !v || new Date(v) > new Date(),
  'Date must be in the future'
);

/** ISO date string (any, present or future) */
const dateString = z.string().refine(
  (v) => !v || !isNaN(Date.parse(v)),
  'Please enter a valid date'
);

// ---------------------------------------------------------------------------
// Password helpers
// ---------------------------------------------------------------------------

export const passwordRules = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/(?=.*[a-z])/, 'Password must contain at least one lowercase letter')
  .regex(/(?=.*[A-Z])/, 'Password must contain at least one uppercase letter')
  .regex(/(?=.*\d)/, 'Password must contain at least one number');

/** Returns a 0-4 strength score for a password */
export const getPasswordStrength = (password: string): number => {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  return score;
};

export const getPasswordStrengthLabel = (strength: number): string => {
  return ['', 'Weak', 'Fair', 'Good', 'Strong'][strength] ?? 'Very Strong';
};

export const getPasswordStrengthColor = (strength: number): string => {
  return ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500'][strength] ?? 'bg-green-600';
};

// ---------------------------------------------------------------------------
// Real-time single-field validation
// ---------------------------------------------------------------------------

/**
 * Validate a single field against a Zod schema. Returns an error message or
 * undefined when valid.
 *
 * Usage:
 *   const err = validateField(z.string().min(3), value);
 */
export const validateField = (
  schema: z.ZodTypeAny,
  value: unknown
): string | undefined => {
  const result = schema.safeParse(value);
  if (result.success) return undefined;
  return result.error.errors[0]?.message;
};

/**
 * Run `validateField` on blur and return the error (or undefined).
 * Designed to be used as an `onBlur` handler.
 */
export const createBlurValidator =
  (schema: z.ZodTypeAny) =>
  (value: unknown): string | undefined =>
    validateField(schema, value);

// ---------------------------------------------------------------------------
// Auth validation schemas
// ---------------------------------------------------------------------------
export const loginSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email('Please enter a valid email address'),
  password: passwordRules,
  confirmPassword: z.string(),
  first_name: z.string().min(1, 'First name is required').max(50, 'First name must be less than 50 characters'),
  last_name: z.string().min(1, 'Last name is required').max(50, 'Last name must be less than 50 characters'),
  phone: z.string().regex(phoneRegex, 'Please enter a valid phone number').optional().or(z.literal('')),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  new_password: passwordRules,
  confirmPassword: z.string(),
}).refine((data) => data.new_password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Course validation schemas
export const courseSchema = z.object({
  title: z.string()
    .min(5, 'Course title must be at least 5 characters')
    .max(255, 'Course title must be less than 255 characters'),
  description: z.string()
    .min(20, 'Course description must be at least 20 characters')
    .max(2000, 'Course description must be less than 2000 characters'),
  learning_objectives: z.string().max(1000, 'Learning objectives must be less than 1000 characters').optional(),
  target_audience: z.string().max(255, 'Target audience must be less than 255 characters').optional(),
  estimated_duration: z.string().max(100, 'Estimated duration must be less than 100 characters').optional(),
  instructor_id: z.number().optional(),
});

export const moduleSchema = z.object({
  title: z.string()
    .min(3, 'Module title must be at least 3 characters')
    .max(255, 'Module title must be less than 255 characters'),
  description: z.string().max(1000, 'Module description must be less than 1000 characters').optional(),
  course_id: z.number().min(1, 'Course ID is required'),
  order_index: z.number().min(0, 'Order index must be a positive number'),
});

export const lessonSchema = z.object({
  title: z.string()
    .min(3, 'Lesson title must be at least 3 characters')
    .max(255, 'Lesson title must be less than 255 characters'),
  content: z.string()
    .min(10, 'Lesson content must be at least 10 characters'),
  module_id: z.number().min(1, 'Module ID is required'),
  order_index: z.number().min(0, 'Order index must be a positive number'),
  video_url: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
});

export const quizSchema = z.object({
  title: z.string()
    .min(3, 'Quiz title must be at least 3 characters')
    .max(255, 'Quiz title must be less than 255 characters'),
  description: z.string().max(1000, 'Quiz description must be less than 1000 characters').optional(),
  module_id: z.number().min(1, 'Module ID is required'),
  time_limit: z.number().min(1, 'Time limit must be at least 1 minute').optional(),
  max_attempts: z.number().min(1, 'Maximum attempts must be at least 1').optional(),
});

export const questionSchema = z.object({
  quiz_id: z.number().min(1, 'Quiz ID is required'),
  question_text: z.string()
    .min(5, 'Question text must be at least 5 characters')
    .max(1000, 'Question text must be less than 1000 characters'),
  question_type: z.enum(['multiple_choice', 'true_false', 'short_answer']),
  points: z.number().min(0.1, 'Points must be greater than 0'),
  order_index: z.number().min(0, 'Order index must be a positive number'),
});

export const answerSchema = z.object({
  question_id: z.number().min(1, 'Question ID is required'),
  answer_text: z.string()
    .min(1, 'Answer text is required')
    .max(500, 'Answer text must be less than 500 characters'),
  is_correct: z.boolean(),
});

// Opportunity validation schemas
export const opportunitySchema = z.object({
  title: z.string()
    .min(5, 'Opportunity title must be at least 5 characters')
    .max(255, 'Opportunity title must be less than 255 characters'),
  description: z.string()
    .min(20, 'Opportunity description must be at least 20 characters')
    .max(2000, 'Opportunity description must be less than 2000 characters'),
  organization: z.string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(255, 'Organization name must be less than 255 characters'),
  location: z.string().max(255, 'Location must be less than 255 characters').optional(),
  application_deadline: z.string().refine((date) => {
    const parsed = new Date(date);
    return parsed > new Date();
  }, 'Application deadline must be in the future'),
  requirements: z.string().max(2000, 'Requirements must be less than 2000 characters').optional(),
  benefits: z.string().max(2000, 'Benefits must be less than 2000 characters').optional(),
  application_url: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  contact_email: z.string().email('Please enter a valid email address').optional().or(z.literal('')),
  opportunity_type: z.enum(['scholarship', 'internship', 'job', 'fellowship', 'grant', 'other']),
});

// User profile validation schemas

export const profileUpdateSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(50, 'First name must be less than 50 characters'),
  last_name: z.string().min(1, 'Last name is required').max(50, 'Last name must be less than 50 characters'),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  phone: z.string().regex(phoneRegex, 'Please enter a valid phone number').optional().or(z.literal('')),
  profile_picture_url: optionalUrl,
});

export const changePasswordSchema = z.object({
  old_password: z.string().min(1, 'Current password is required'),
  new_password: passwordRules,
  confirmPassword: z.string(),
}).refine((data) => data.new_password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// ---------------------------------------------------------------------------
// Additional schemas
// ---------------------------------------------------------------------------

export const announcementSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(255, 'Title must be less than 255 characters'),
  content: z.string().min(10, 'Content must be at least 10 characters').max(5000, 'Content must be less than 5000 characters'),
  course_id: z.number().min(1, 'Course is required'),
});

export const assignmentSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(255, 'Title must be less than 255 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(5000, 'Description must be less than 5000 characters'),
  module_id: z.number().min(1, 'Module is required'),
  due_date: futureDateString.optional(),
  max_score: z.number().min(1, 'Max score must be at least 1').max(1000, 'Max score must be less than 1000').optional(),
  submission_instructions: z.string().max(2000, 'Instructions must be less than 2000 characters').optional(),
});

export const projectSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(255, 'Title must be less than 255 characters'),
  description: z.string().min(20, 'Description must be at least 20 characters').max(5000, 'Description must be less than 5000 characters'),
  module_id: z.number().min(1, 'Module is required'),
  due_date: futureDateString.optional(),
  max_score: z.number().min(1, 'Max score must be at least 1').max(1000, 'Max score must be less than 1000').optional(),
  requirements: z.string().max(2000, 'Requirements must be less than 2000 characters').optional(),
  resources_url: optionalUrl,
});

export const courseSchemaExtended = z.object({
  title: z.string().min(5, 'Course title must be at least 5 characters').max(255, 'Course title must be less than 255 characters'),
  description: z.string().min(20, 'Course description must be at least 20 characters').max(2000, 'Course description must be less than 2000 characters'),
  learning_objectives: z.string().max(1000, 'Learning objectives must be less than 1000 characters').optional(),
  target_audience: z.string().max(255, 'Target audience must be less than 255 characters').optional(),
  estimated_duration: z.string().max(100, 'Estimated duration must be less than 100 characters').optional(),
  application_start_date: dateString.optional().or(z.literal('')),
  application_end_date: dateString.optional().or(z.literal('')),
  cohort_start_date: dateString.optional().or(z.literal('')),
  cohort_end_date: dateString.optional().or(z.literal('')),
  cohort_label: z.string().max(100, 'Cohort label must be less than 100 characters').optional(),
  application_timezone: z.string().max(50, 'Timezone must be less than 50 characters').optional(),
}).refine(
  (d) => {
    if (d.application_start_date && d.application_end_date) {
      return new Date(d.application_end_date) >= new Date(d.application_start_date);
    }
    return true;
  },
  { message: 'Application end date must be after start date', path: ['application_end_date'] }
).refine(
  (d) => {
    if (d.cohort_start_date && d.cohort_end_date) {
      return new Date(d.cohort_end_date) >= new Date(d.cohort_start_date);
    }
    return true;
  },
  { message: 'Cohort end date must be after start date', path: ['cohort_end_date'] }
);

// Validation helper functions
export const validateForm = <T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  errors?: Record<string, string[]>;
} => {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string[]> = {};
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(err.message);
      });
      return { success: false, errors };
    }
    return { 
      success: false, 
      errors: { general: [ApiErrorHandler.getErrorMessage(error)] }
    };
  }
};

export const getFieldError = (errors: Record<string, string[]> | undefined, fieldName: string): string | undefined => {
  return errors?.[fieldName]?.[0];
};

export const hasFieldError = (errors: Record<string, string[]> | undefined, fieldName: string): boolean => {
  return Boolean(errors?.[fieldName]?.length);
};

// Form submission helper
export const handleFormSubmission = async <TData, TResult>(
  data: TData,
  schema: z.ZodSchema<TData>,
  submitFunction: (validData: TData) => Promise<TResult>
): Promise<{ success: boolean; result?: TResult; errors?: Record<string, string[]> }> => {
  const validation = validateForm(schema, data);
  
  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  try {
    const result = await submitFunction(validation.data!);
    return { success: true, result };
  } catch (error) {
    const apiError = ApiErrorHandler.handleError(error);
    
    // If it's a validation error from the backend, try to parse field-specific errors
    if (apiError.status === 400 || apiError.status === 422) {
      const details = apiError.details;
      if (details && typeof details === 'object' && details.errors) {
        return { success: false, errors: details.errors };
      }
    }
    
    return { 
      success: false, 
      errors: { general: [apiError.message] }
    };
  }
};