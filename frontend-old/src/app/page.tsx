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

