'use client';
import React, { useState, FormEvent, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const Input = ({ error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) => (
  <div className="relative">
    <input
      {...props}
      className={`w-full px-4 py-3 bg-white/5 border ${
        error ? 'border-red-500' : 'border-white/10'
      } rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-white placeholder-slate-400 transition-all`}
    />
    {error && (
      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
        <AlertCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
      </div>
    )}
  </div>
);

const PasswordStrength = ({ password }: { password: string }) => {
  const getStrength = () => {
    if (!password) return 0;
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (password.match(/[A-Z]/)) strength += 1;
    if (password.match(/[0-9]/)) strength += 1;
    if (password.match(/[^A-Za-z0-9]/)) strength += 1;
    return strength;
  };

  const strength = getStrength();
  const colors = ['bg-red-500', 'bg-amber-500', 'bg-yellow-500', 'bg-green-500'];
  const labels = ['Very Weak', 'Weak', 'Medium', 'Strong'];
  
  return (
    <div className="mt-2 space-y-1">
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${colors[strength] || ''}`}
          style={{ width: `${(strength / 4) * 100}%` }}
        />
      </div>
      <span className={`text-sm ${colors[strength]}`}>
        {labels[strength] || 'Password Strength'}
      </span>
    </div>
  );
};

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const validateField = (name: string, value: string) => {
    const newErrors = { ...errors };

    switch (name) {
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          newErrors.email = 'Invalid email address';
        } else {
          delete newErrors.email;
        }
        break;
      case 'password':
        if (value.length < 8) {
          newErrors.password = 'Password must be at least 8 characters';
        } else {
          delete newErrors.password;
        }
        if (formData.confirmPassword && value !== formData.confirmPassword) {
          newErrors.confirmPassword = 'Passwords do not match';
        } else {
          delete newErrors.confirmPassword;
        }
        break;
      case 'confirmPassword':
        if (value !== formData.password) {
          newErrors.confirmPassword = 'Passwords do not match';
        } else {
          delete newErrors.confirmPassword;
        }
        break;
      default:
        if (!value && name !== 'firstName' && name !== 'lastName') {
          newErrors[name] = 'This field is required';
        } else {
          delete newErrors[name];
        }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    try {
      await register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        first_name: formData.firstName,
        last_name: formData.lastName
      });
      router.push('/auth/login?registered=true');
    } catch (err: any) {
      setErrors({
        form: err.message || 'An unexpected error occurred. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    validateField(name, value);
  };

  const isValid = Object.keys(errors).length === 0 && 
    formData.username && 
    formData.email && 
    formData.password && 
    formData.confirmPassword;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white/5 backdrop-blur-sm p-8 rounded-2xl shadow-xl w-full max-w-2xl border border-white/10">
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

        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white">Create Your Account</h2>
          <p className="mt-2 text-slate-400">
            Already have an account?{' '}
            <Link 
              href="/auth/login" 
              className="text-sky-400 hover:text-sky-300 underline-offset-4 hover:underline"
            >
              Sign in here
            </Link>
          </p>
        </div>

        {errors.form && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-100 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <span>{errors.form}</span>
          </div>
        )}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Username *
              </label>
              <Input
                name="username"
                value={formData.username}
                onChange={handleChange}
                error={errors.username}
                placeholder="Enter your username"
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-500">{errors.username}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email Address *
              </label>
              <Input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                placeholder="your.email@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-500">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                First Name *
              </label>
              <Input
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Your First Name(If any)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Last Name
              </label>
              <Input
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Your Last  Name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password *
              </label>
              <Input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                placeholder="••••••••"
              />
              <PasswordStrength password={formData.password} />
              {errors.password && (
                <p className="mt-1 text-sm text-red-500">{errors.password}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Confirm Password *
              </label>
              <Input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                error={errors.confirmPassword}
                placeholder="••••••••"
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>
              )}
            </div>
          </div>

          <div className="mt-8">
            <button
              type="submit"
              disabled={!isValid || isLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-6 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-lg shadow-lg transition-all duration-300 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5" />
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </div>

          <div className="relative mt-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-transparent text-slate-400">
                Or sign up with
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-6">
            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z"/>
              </svg>
              Google
            </button>
            
            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.373 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.113.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </button>
          </div>

          <p className="mt-8 text-center text-slate-400 text-sm">
            By creating an account, you agree to our{' '}
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