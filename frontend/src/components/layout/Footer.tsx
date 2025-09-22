"use client";

import React from 'react';
import Link from 'next/link';
import { Github, Linkedin, Twitter, Mail } from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  // Creative element: A subtle gradient text for the brand name
  const BrandName = () => (
    <span className="font-semibold">
      Afritec<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-orange-500">Bridge</span>
    </span>
  );

  const socialLinks = [
    { href: "https://github.com/afritecbridge", label: "GitHub", icon: <Github size={20} /> },
    { href: "https://linkedin.com/company/afritecbridge", label: "LinkedIn", icon: <Linkedin size={20} /> },
    { href: "https://twitter.com/afritecbridge", label: "Twitter", icon: <Twitter size={20} /> },
    { href: "mailto:info@afritecbridge.com", label: "Email", icon: <Mail size={20} /> },
  ];

  const footerLinks = [
    { href: "/about", label: "About Us" },
    { href: "/contact", label: "Contact" },
    { href: "/terms", label: "Terms of Service" },
    { href: "/privacy", label: "Privacy Policy" },
  ];

  return (
    <footer className="bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Top section: Links and Social Media */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Branding & Mission (Optional) */}
          <div className="col-span-1 md:col-span-1">
            <Link href="/" legacyBehavior>
              <a className="text-xl font-bold text-blue-600 dark:text-blue-400 hover:opacity-80 transition-opacity mb-2 inline-block">
                Afritec<span className="text-orange-500">Bridge</span>
              </a>
            </Link>
            <p className="text-sm leading-relaxed">
              Empowering young African innovators with coding skills and connecting them to global opportunities.
            </p>
          </div>

          {/* Quick Links */}
          <div className="col-span-1 md:col-span-1">
            <h5 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Quick Links</h5>
            <ul className="space-y-2">
              {footerLinks.map(link => (
                <li key={link.href}>
                  <Link href={link.href} legacyBehavior>
                    <a className="hover:text-blue-500 dark:hover:text-blue-400 transition-colors text-sm">
                      {link.label}
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect With Us */}
          <div className="col-span-1 md:col-span-1">
            <h5 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Connect With Us</h5>
            <div className="flex space-x-4 mb-3">
              {socialLinks.map(social => (
                <a 
                  key={social.label} 
                  href={social.href} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                >
                  {social.icon}
                </a>
              ))}
            </div>
            {/* Optional: Newsletter Signup */}
            {/* <p className="text-sm mb-1">Stay updated:</p>
            <form className="flex">
              <input type="email" placeholder="Your email" className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-l-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white w-full" />
              <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-r-md hover:bg-blue-700 transition-colors">Subscribe</button>
            </form> */}
          </div>
        </div>

        {/* Bottom section: Copyright */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-8 text-center text-sm">
          <p>
            &copy; {currentYear} <BrandName />. All rights reserved.
          </p>
          <p className="mt-1">
            Built with <span className="text-red-500">	&hearts;</span> for a brighter African future.
          </p>
        </div>
      </div>
      {/* Subtle geometric pattern overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='52' height='26' viewBox='0 0 52 26' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M10 10c0-2.21-1.79-4-4-4-3.314 0-6-2.686-6-6h2c0 2.21 1.79 4 4 4 3.314 0 6 2.686 6 6 0 2.21 1.79 4 4 4 3.314 0 6 2.686 6 6 0 2.21 1.79 4 4 4v2c-3.314 0-6-2.686-6-6 0-2.21-1.79-4-4-4-3.314 0-6-2.686-6-6zm25.464-1.95l8.486 8.486-1.414 1.414-8.486-8.486 1.414-1.414z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
    </footer>
  );
};

export default Footer;

