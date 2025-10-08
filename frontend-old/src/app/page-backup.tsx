'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

const HomePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Main Content */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden min-h-screen flex items-center">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-full blur-3xl animate-float"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-green-400/20 to-blue-600/20 rounded-full blur-3xl animate-float-delayed"></div>
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Company Logo */}
          <div className="mb-12">
            <div className="relative inline-block">
              <Image
                src="/logo.jpg"
                alt="Afritec Bridge LMS"
                width={150}
                height={150}
                className="rounded-full shadow-2xl border-4 border-white animate-glow mx-auto"
                priority
              />
            </div>
          </div>

          {/* Main Heading */}
          <div className="mb-12">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent mb-6 animate-fade-in-up leading-tight">
              Afritec Bridge LMS
            </h1>
            <p className="text-2xl md:text-3xl text-gray-600 font-medium animate-fade-in-up animation-delay-200">
              Bridging African Talent to Global Opportunities
            </p>
          </div>

          {/* Subheading and Description */}
          <div className="mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-6 animate-fade-in-up animation-delay-400">
              Empower Your Tech Journey
            </h2>
            <h3 className="text-xl md:text-2xl text-gray-600 mb-8 animate-fade-in-up animation-delay-600">
              From Learning to Global Opportunities
            </h3>
            <p className="text-lg md:text-xl text-gray-600 leading-relaxed animate-fade-in-up animation-delay-800 max-w-3xl mx-auto">
              Join Africa's premier learning management system where cutting-edge technology education meets real-world opportunities. Master in-demand skills, connect with industry leaders, and accelerate your career in the global tech ecosystem.
            </p>
          </div>

          {/* Login Button */}
          <div className="animate-fade-in-up animation-delay-1000">
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center px-12 py-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-xl font-semibold rounded-2xl shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300 group"
            >
              Login
              <ArrowRight className="ml-3 w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;

// Enhanced Company Logo Component with actual logo
const CompanyLogo = () => (
  <div className="mb-16 animate-fade-in">
    <div className="flex flex-col items-center justify-center gap-6">
      {/* Company Logo */}
      <div className="relative w-32 h-32 md:w-40 md:h-40 transform hover:scale-105 transition-transform duration-300">
        <div className="absolute inset-0 bg-gradient-to-r from-sky-400 to-blue-500 rounded-2xl blur-lg opacity-30 animate-pulse"></div>
        <div className="relative w-full h-full bg-white rounded-2xl p-4 shadow-2xl">
          <Image
            src="/logo.jpg"
            alt="Afritec Bridge LMS Logo"
            width={160}
            height={160}
            className="w-full h-full object-contain rounded-lg"
            priority
          />
        </div>
      </div>
      
      {/* Company Name with enhanced styling */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-sky-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
          Afritec Bridge LMS
        </h1>
        <p className="text-lg md:text-xl text-slate-300 font-medium">
          Bridging African Talent to Global Opportunities
        </p>
      </div>
    </div>
  </div>
);

// Enhanced Feature Cards
const FeatureCard = ({ icon: Icon, title, description, color }: {
  icon: any;
  title: string;
  description: string;
  color: string;
}) => (
  <div className="group p-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 hover:scale-105">
    <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
      <Icon className="w-6 h-6" />
    </div>
    <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
    <p className="text-slate-300">{description}</p>
  </div>
);

export default function HomePage() {
  return (
    <RootLayout>
      <RootRedirect />
      {/* Add header to the home page */}
      <Header transparent={true} />
      
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
        {/* Enhanced animated background */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(14,165,233,0.3),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_75%,rgba(168,85,247,0.3),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.2),transparent_70%)]" />
        </div>
        
        {/* Floating elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-sky-400 rounded-full animate-ping" style={{ animationDelay: '0s' }}></div>
          <div className="absolute top-3/4 right-1/4 w-1 h-1 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-1/2 left-3/4 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" style={{ animationDelay: '4s' }}></div>
        </div>

        <div className="relative z-10 px-4 py-8 pt-20">
          {/* Header Section */}
          <div className="flex flex-col items-center justify-center min-h-screen text-center max-w-6xl mx-auto">
            <CompanyLogo />

            <div className="space-y-8 max-w-4xl">
              <h2 className="text-4xl md:text-6xl font-bold mb-6 animate-slide-up leading-tight">
                Empower Your Tech Journey
                <span className="block mt-4 text-2xl md:text-3xl font-normal text-slate-300 italic">
                  From Learning to Global Opportunities
                </span>
              </h2>

              <p className="text-lg md:text-xl text-slate-300 mb-10 max-w-3xl mx-auto leading-relaxed">
                Join Africa's premier learning management system where cutting-edge technology education 
                meets real-world opportunities. Master in-demand skills, connect with industry leaders, 
                and accelerate your career in the global tech ecosystem.
              </p>

              {/* Enhanced CTA Buttons */}
              <div className="flex flex-col sm:flex-row justify-center gap-6 animate-fade-in-up">
                <Link 
                  href="/student/courses"
                  className="group px-8 py-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 
                           text-white font-semibold rounded-2xl shadow-xl hover:shadow-2xl hover:shadow-sky-500/25 
                           text-lg transition-all duration-300 flex items-center justify-center gap-3 transform hover:scale-105"
                >
                  <BookOpen className="w-5 h-5" />
                  Explore Courses
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link 
                  href="/student/opportunities"
                  className="group px-8 py-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 
                           text-white font-semibold rounded-2xl shadow-xl hover:shadow-2xl hover:shadow-emerald-500/25 
                           text-lg transition-all duration-300 flex items-center justify-center gap-3 transform hover:scale-105"
                >
                  <Briefcase className="w-5 h-5" />
                  Find Opportunities
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              {/* Enhanced Stats Section */}
              <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 animate-stagger">
                <div className="group p-6 bg-gradient-to-br from-sky-500/10 to-blue-500/10 rounded-2xl backdrop-blur-sm 
                              border border-sky-500/20 hover:border-sky-400/40 transition-all duration-300 transform hover:scale-105">
                  <div className="flex items-center justify-center mb-4">
                    <Users className="w-8 h-8 text-sky-400" />
                  </div>
                  <div className="text-4xl font-bold text-sky-400 mb-2">10K+</div>
                  <div className="text-slate-300 font-medium">Students Empowered</div>
                  <div className="text-xs text-slate-400 mt-1">Across 54 African countries</div>
                </div>
                
                <div className="group p-6 bg-gradient-to-br from-emerald-500/10 to-green-500/10 rounded-2xl backdrop-blur-sm 
                              border border-emerald-500/20 hover:border-emerald-400/40 transition-all duration-300 transform hover:scale-105">
                  <div className="flex items-center justify-center mb-4">
                    <BookOpen className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div className="text-4xl font-bold text-emerald-400 mb-2">150+</div>
                  <div className="text-slate-300 font-medium">Courses Available</div>
                  <div className="text-xs text-slate-400 mt-1">From beginner to expert level</div>
                </div>
                
                <div className="group p-6 bg-gradient-to-br from-purple-500/10 to-violet-500/10 rounded-2xl backdrop-blur-sm 
                              border border-purple-500/20 hover:border-purple-400/40 transition-all duration-300 transform hover:scale-105">
                  <div className="flex items-center justify-center mb-4">
                    <TrendingUp className="w-8 h-8 text-purple-400" />
                  </div>
                  <div className="text-4xl font-bold text-purple-400 mb-2">500+</div>
                  <div className="text-slate-300 font-medium">Job Opportunities</div>
                  <div className="text-xs text-slate-400 mt-1">Updated weekly</div>
                </div>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div className="max-w-6xl mx-auto py-20">
            <div className="text-center mb-16">
              <h3 className="text-3xl md:text-4xl font-bold mb-4">Why Choose Afritec Bridge?</h3>
              <p className="text-xl text-slate-300 max-w-2xl mx-auto">
                Experience the future of African tech education with our comprehensive platform
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <FeatureCard
                icon={Award}
                title="Industry Recognition"
                description="Earn certificates recognized by leading tech companies across Africa and globally."
                color="bg-gradient-to-br from-yellow-500 to-orange-500"
              />
              <FeatureCard
                icon={Users}
                title="Expert Instructors"
                description="Learn from industry professionals and thought leaders with real-world experience."
                color="bg-gradient-to-br from-blue-500 to-cyan-500"
              />
              <FeatureCard
                icon={Globe}
                title="Global Network"
                description="Connect with peers, mentors, and employers across the African tech ecosystem."
                color="bg-gradient-to-br from-green-500 to-emerald-500"
              />
              <FeatureCard
                icon={TrendingUp}
                title="Career Growth"
                description="Access exclusive job opportunities and accelerate your professional development."
                color="bg-gradient-to-br from-purple-500 to-pink-500"
              />
            </div>
          </div>

          {/* Enhanced CTA Section */}
          <div className="text-center py-16 animate-fade-in">
            <div className="max-w-2xl mx-auto p-8 bg-gradient-to-r from-sky-500/10 to-purple-500/10 rounded-3xl backdrop-blur-sm border border-white/10">
              <h4 className="text-2xl md:text-3xl font-bold mb-4">Ready to Transform Your Future?</h4>
              <p className="text-slate-300 mb-8">
                Join thousands of African tech professionals who have already started their journey with us.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link 
                  href="/auth/register" 
                  className="px-8 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 
                           text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 
                           flex items-center gap-2 transform hover:scale-105"
                >
                  <Star className="w-5 h-5" />
                  Start Free Today
                </Link>
                
                <span className="text-slate-400">or</span>
                
                <Link 
                  href="/auth/login" 
                  className="text-sky-400 hover:text-sky-300 font-semibold underline-offset-4 hover:underline 
                           flex items-center gap-2 transition-colors"
                >
                  Sign In to Continue
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </RootLayout>
  );
}