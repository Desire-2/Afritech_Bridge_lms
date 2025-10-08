import { z } from 'zod';
import { ApiErrorHandler } from '@/lib/error-handler';

// Auth validation schemas
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
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/(?=.*[a-z])/, 'Password must contain at least one lowercase letter')
    .regex(/(?=.*[A-Z])/, 'Password must contain at least one uppercase letter')
    .regex(/(?=.*\d)/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
  first_name: z.string().min(1, 'First name is required').max(50, 'First name must be less than 50 characters'),
  last_name: z.string().min(1, 'Last name is required').max(50, 'Last name must be less than 50 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  new_password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/(?=.*[a-z])/, 'Password must contain at least one lowercase letter')
    .regex(/(?=.*[A-Z])/, 'Password must contain at least one uppercase letter')
    .regex(/(?=.*\d)/, 'Password must contain at least one number'),
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
  profile_picture_url: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
});

export const changePasswordSchema = z.object({
  old_password: z.string().min(1, 'Current password is required'),
  new_password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/(?=.*[a-z])/, 'Password must contain at least one lowercase letter')
    .regex(/(?=.*[A-Z])/, 'Password must contain at least one uppercase letter')
    .regex(/(?=.*\d)/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.new_password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

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