'use client';

import Link from 'next/link';
import RootLayout from './layout';
import RootRedirect from './root-redirect';

// Company Logo Component
const CompanyLogo = () => (
  <div className="mb-12 animate-fade-in">
    <div className="flex items-center justify-center gap-3">
      <svg 
        className="w-16 h-16 text-sky-400"
        viewBox="0 0 64 64" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          d="M32 0L38.9282 24H25.0718L32 0ZM50.954 18L57.8822 42H44.0258L50.954 18ZM13.046 18L19.9742 42H6.11783L13.046 18ZM32 48L38.9282 72H25.0718L32 48Z" 
          fill="currentColor"
        />
        <path 
          d="M32 8L40 32H24L32 8ZM48 24L56 48H40L48 24ZM16 24L24 48H8L16 24ZM32 40L40 64H24L32 40Z" 
          fill="url(#logo-gradient)"
        />
        <defs>
          <linearGradient 
            id="logo-gradient" 
            x1="32" 
            y1="0" 
            x2="32" 
            y2="64" 
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#7DD3FC" />
            <stop offset="1" stopColor="#0EA5E9" />
          </linearGradient>
        </defs>
      </svg>
      <span className="text-4xl font-bold bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">
        Afritec Bridge
      </span>
    </div>
  </div>
);

export default function HomePage() {
  return (
    <RootLayout>
      <RootRedirect />
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 opacity-10 bg-[url('/grid-pattern.svg')] bg-cover" />
        <div className="absolute inset-0 bg-gradient-radial from-sky-400/10 to-transparent" />

        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen">
          <CompanyLogo />

          <div className="text-center max-w-3xl space-y-8">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-slide-up">
              Empower Your Tech Journey
              <span className="block mt-4 text-3xl md:text-4xl font-normal text-slate-300">
                From Learning to Opportunity
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
              Join a community-driven platform where African talent meets global tech opportunities. 
              Master in-demand skills and accelerate your career.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-6 animate-fade-in-up">
              <Link 
                href="/student/courses"
                className="px-8 py-4 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-xl shadow-lg 
                         transition-all duration-300 hover:shadow-2xl hover:shadow-sky-500/20 text-lg
                         flex items-center justify-center gap-2"
              >
                <span className="text-2xl">🎓</span>
                Explore Courses
              </Link>
              <Link 
                href="/opportunities"
                className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl shadow-lg 
                         transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/20 text-lg
                         flex items-center justify-center gap-2"
              >
                <span className="text-2xl">🌍</span>
                Find Opportunities
              </Link>
            </div>

            <div className="mt-16 grid grid-cols-3 gap-8 text-center animate-stagger">
              <div className="p-4 bg-white/5 rounded-xl backdrop-blur-sm hover:bg-white/10 transition-all">
                <div className="text-3xl font-bold text-sky-400">10K+</div>
                <div className="text-slate-400">Students Empowered</div>
              </div>
              <div className="p-4 bg-white/5 rounded-xl backdrop-blur-sm hover:bg-white/10 transition-all">
                <div className="text-3xl font-bold text-emerald-400">150+</div>
                <div className="text-slate-400">Courses Available</div>
              </div>
              <div className="p-4 bg-white/5 rounded-xl backdrop-blur-sm hover:bg-white/10 transition-all">
                <div className="text-3xl font-bold text-purple-400">500+</div>
                <div className="text-slate-400">Opportunities Posted</div>
              </div>
            </div>

            <div className="mt-12 animate-fade-in">
              <p className="text-slate-400">
                Already part of our community?{' '}
                <Link 
                  href="/auth/login" 
                  className="text-sky-400 hover:text-sky-300 font-medium underline-offset-4 hover:underline"
                >
                  Sign In Now
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </RootLayout>
  );
}