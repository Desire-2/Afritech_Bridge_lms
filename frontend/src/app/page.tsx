'use client';

import Image from 'next/image';
import Link from 'next/link';
import RootRedirect from './root-redirect';

// Company Logo Component (uses public/logo.jpg)
const CompanyLogo = () => (
  <div className="mb-12 animate-fade-in">
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="relative w-40 h-40 rounded-full overflow-hidden shadow-2xl ring-4 ring-sky-500/30 transform transition-all duration-500 hover:scale-105 hover:rotate-3">
        <Image
          src="/logo.jpg"
          alt="Afritec Bridge logo"
          fill
          sizes="160px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent mix-blend-overlay" />
      </div>

      <span className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-sky-300 via-blue-400 to-indigo-500 bg-clip-text text-transparent drop-shadow-sm">
        AfriTech Bridge
      </span>
      <div className="mt-2 text-sm text-slate-300">Learn. Build. Connect.</div>
    </div>
  </div>
);

export default function HomePage() {
  return (
    <>
      <RootRedirect />
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 opacity-10 bg-[url('/grid-pattern.svg')] bg-cover" />
        <div className="absolute inset-0 bg-gradient-radial from-sky-400/10 to-transparent" />

        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen">
          <CompanyLogo />

          <div className="text-center max-w-3xl space-y-8">
            <h1 className="text-5xl md:text-7xl font-bold animate-slide-up">
              Empower Your Tech Journey
              <span className="block mt-4 text-3xl md:text-4xl font-normal text-slate-300">
                From Learning to Opportunity
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Apply to practical tech training programs designed for African youth, 
              including learners from rural and underserved communities.
            </p>

            {/* APPLY BUTTON */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 animate-fade-in-up">
              <Link
                href="/courses"
                className="px-10 py-5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl shadow-xl 
                           transition-all duration-300 hover:shadow-2xl hover:shadow-sky-500/30 text-xl
                           flex items-center justify-center gap-3"
              >
                <span className="text-3xl">📚</span>
                Browse Courses
              </Link>
              <Link
                href="/auth/login?redirect=/student/dashboard"
                className="px-10 py-5 bg-transparent border-2 border-sky-400 hover:bg-sky-400/10 text-sky-400 font-bold rounded-2xl shadow-xl 
                           transition-all duration-300 hover:shadow-2xl hover:shadow-sky-400/30 text-xl
                           flex items-center justify-center gap-3"
              >
                <span className="text-3xl">🔐</span>
                Sign In
              </Link>
            </div>

            {/* STATS */}
            <div className="mt-16 grid grid-cols-3 gap-8 text-center animate-stagger">
              <div className="p-4 bg-white/5 rounded-xl backdrop-blur-sm hover:bg-white/10 transition-all">
                <div className="text-3xl font-bold text-sky-400">10K+</div>
                <div className="text-slate-400">Learners Trained</div>
              </div>
              <div className="p-4 bg-white/5 rounded-xl backdrop-blur-sm hover:bg-white/10 transition-all">
                <div className="text-3xl font-bold text-emerald-400">Rural</div>
                <div className="text-slate-400">Friendly Programs</div>
              </div>
              <div className="p-4 bg-white/5 rounded-xl backdrop-blur-sm hover:bg-white/10 transition-all">
                <div className="text-3xl font-bold text-purple-400">AI</div>
                <div className="text-slate-400">Fair Selection</div>
              </div>
            </div>

            {/* LOGIN 
            <div className="mt-12 animate-fade-in">
              <p className="text-slate-400">
                Already admitted?{' '}
                <Link 
                  href="/auth/login" 
                  className="text-sky-400 hover:text-sky-300 font-medium underline-offset-4 hover:underline"
                >
                  Sign In
                </Link>
              </p>
            </div>
            */}

          </div>
        </div>
      </main>
    </>
  );
}
