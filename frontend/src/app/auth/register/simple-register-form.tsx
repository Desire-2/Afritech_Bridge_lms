'use client';
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  registerSchema, 
  handleFormSubmission, 
  getFieldError 
} from '@/lib/form-validation';
import { 
  Form, 
  FormField, 
  SubmitButton, 
  ErrorAlert, 
  SuccessAlert 
} from '@/components/ui/form-components';
import { useFormSubmission } from '@/hooks/use-api';

interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  first_name: string;
  last_name: string;
}

const RegisterForm = () => {
  const { register } = useAuth();
  const router = useRouter();
  const { loading, error, success, submit, reset } = useFormSubmission();
  
  const [formData, setFormData] = useState<RegisterFormData>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
  });
  
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear validation error for this field when user starts typing
    if (validationErrors?.[name]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return Object.keys(newErrors).length > 0 ? newErrors : undefined;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    reset();

    const result = await handleFormSubmission(
      formData,
      registerSchema,
      async (validData) => {
        const { confirmPassword, ...registerData } = validData;
        return await register(registerData);
      }
    );

    if (!result.success) {
      setValidationErrors(result.errors);
    } else {
      // Registration successful, user will be redirected by AuthContext
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
            <p className="text-slate-300">Join Afritec Bridge LMS</p>
          </div>

          <Form onSubmit={handleSubmit} disabled={loading}>
            {success && (
              <SuccessAlert message="Registration successful! You will be redirected to login." />
            )}
            
            <ErrorAlert errors={validationErrors} />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="First Name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                error={getFieldError(validationErrors, 'first_name')}
                required
                placeholder="John"
              />
              
              <FormField
                label="Last Name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                error={getFieldError(validationErrors, 'last_name')}
                required
                placeholder="Doe"
              />
            </div>

            <FormField
              label="Username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              error={getFieldError(validationErrors, 'username')}
              required
              placeholder="johndoe"
            />

            <FormField
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              error={getFieldError(validationErrors, 'email')}
              required
              placeholder="john@example.com"
            />

            <FormField
              label="Password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              error={getFieldError(validationErrors, 'password')}
              required
              placeholder="••••••••"
            />

            <FormField
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              error={getFieldError(validationErrors, 'confirmPassword')}
              required
              placeholder="••••••••"
            />

            <SubmitButton loading={loading} className="w-full">
              {loading ? 'Creating Account...' : 'Create Account'}
            </SubmitButton>
          </Form>

          <div className="mt-6 text-center">
            <p className="text-slate-300">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-sky-400 hover:text-sky-300 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;