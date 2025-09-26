'use client';
import React, { useState, FormEvent, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

const Input = ({ error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) => {
  const [show, setShow] = useState(false);
  const isPassword = props.type === 'password' || String(props.name).toLowerCase().includes('password');
  const inputType = isPassword ? (show ? 'text' : 'password') : props.type;

  return (
    <div className="relative">
      <input
        {...props}
        type={inputType}
        className={`w-full px-4 py-3 bg-white/5 border ${
          error ? 'border-red-500' : 'border-white/10'
        } rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-white placeholder-slate-400 transition-all`}
      />

      {/* Show/hide toggle placed to the right; if there's an error icon it will appear further right */}
      {isPassword && (
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-pressed={show}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-10 pr-3 flex items-center text-slate-300 hover:text-sky-400"
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      )}

      {error && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <AlertCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
        </div>
      )}
    </div>
  );
};

const PasswordStrength = ({ password }: { password: string }) => {
  const getStrength = () => {
    if (!password) return 0;
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (password.match(/[A-Z]/)) strength += 1;
    if (password.match(/[0-9]/)) strength += 1;
    if (password.match(/[^a-zA-Z0-9]/)) strength += 1;
    return strength;
  };

  const strength = getStrength();
  const width = `${(strength / 4) * 100}%`;
  const color = strength < 2 ? 'bg-red-500' : strength < 4 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="mt-1">
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-300`} style={{ width }} />
      </div>
      <span className="text-xs mt-1 block text-slate-400">
        {strength < 2 ? 'Weak' : strength < 4 ? 'Medium' : 'Strong'} Password
      </span>
    </div>
  );
};

export default function RegisterForm() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [step, setStep] = useState(1); // 1 for account details, 2 for personal details
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one uppercase letter';
    } else if (!/[0-9]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one number';
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const nextStep = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const prevStep = () => {
    setStep(1);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (step === 1) {
      nextStep();
      return;
    }
    
    if (!validateStep2()) {
      return;
    }
    
    setIsSubmitting(true);
    setServerError('');
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/v1/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          first_name: formData.firstName,
          last_name: formData.lastName,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error((data as any).message || 'Registration failed');
      }
      
      // Registration successful, redirect to login
      router.push('/auth/login?registered=true');
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="bg-white/5 backdrop-blur-sm p-8 rounded-2xl shadow-xl w-full max-w-md border border-white/10">
        {/* Company Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <svg 
            className="w-10 h-10 text-sky-400"
            viewBox="0 0 64 64" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              d="M32 0L38.9282 24H25.0718L32 0ZM50.954 18L57.8822 42H44.0258L50.954 18ZM13.046 18L19.9742 42H6.11783L13.046 18ZM32 48L38.9282 72H25.0718L32 48Z" 
              fill="currentColor"
            />
          </svg>
          <span className="text-2xl font-bold bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">
            Afritec Bridge
          </span>
        </div>

        <h2 className="text-3xl font-bold mb-8 text-center text-white">
          {step === 1 ? 'Create Account' : 'Personal Information'}
        </h2>
        
        {serverError && (
          <div className="bg-red-500/20 border border-red-500/30 text-red-100 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {step === 1 ? (
            <>
              {/* Step 1: Account Details */}
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-2">
                  Username
                </label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Choose a username"
                  error={errors.username}
                />
                {errors.username && <p className="mt-1 text-sm text-red-400">{errors.username}</p>}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                  Email Address
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="your.email@example.com"
                  error={errors.email}
                />
                {errors.email && <p className="mt-1 text-sm text-red-400">{errors.email}</p>}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                  Password
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  error={errors.password}
                />
                {errors.password ? (
                  <p className="mt-1 text-sm text-red-400">{errors.password}</p>
                ) : (
                  <PasswordStrength password={formData.password} />
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-2">
                  Confirm Password
                </label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  error={errors.confirmPassword}
                />
                {errors.confirmPassword && <p className="mt-1 text-sm text-red-400">{errors.confirmPassword}</p>}
              </div>

              <button
                type="button"
                onClick={nextStep}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-6 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-lg shadow-lg transition-all duration-300"
              >
                Continue
              </button>
            </>
          ) : (
            <>
              {/* Step 2: Personal Details */}
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-slate-300 mb-2">
                  First Name
                </label>
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="Your first name"
                  error={errors.firstName}
                />
                {errors.firstName && <p className="mt-1 text-sm text-red-400">{errors.firstName}</p>}
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-slate-300 mb-2">
                  Last Name
                </label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Your last name"
                  error={errors.lastName}
                />
                {errors.lastName && <p className="mt-1 text-sm text-red-400">{errors.lastName}</p>}
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex-1 py-3.5 px-6 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg shadow transition-all duration-300"
                >
                  Back
                </button>
                
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-lg shadow-lg transition-all duration-300 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin h-5 w-5" />
                      Registering...
                    </>
                  ) : 'Register'}
                </button>
              </div>
            </>
          )}

          <p className="mt-4 text-center text-xs text-slate-400">
            By registering, you agree to our{' '}
            <Link href="/terms" className="text-sky-400 hover:text-sky-300 underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-sky-400 hover:text-sky-300 underline">
              Privacy Policy
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}