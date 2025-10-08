"use client";

import React from 'react';
import Header from './Header';
import Footer from './Footer';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      <Header />
      {/* Creative element: A subtle gradient background for the main content area, or a very light pattern */}
      {/* For simplicity, using a clean background that contrasts with Header/Footer */}
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* 
          The main content area will expand to fill available space.
          A common pattern is to have a max-width container within this 
          for the actual page content, which is handled by the `container mx-auto` classes.
        */}
        {children}
      </main>
      <Footer />
      {/* 
        Creative Element Idea from Design: 
        "Perhaps a subtle, full-height sidebar element (very thin) on one side that contains 
        a slowly shifting gradient or a very abstract, tall pattern that adds a touch of visual 
        interest without distracting from the main content. This could be optional or section-specific."
        This would be more complex to implement globally here without more context on when/where it should appear.
        For now, keeping the main layout clean and focused on structure.
        Such an element could be added to specific page layouts that use this MainLayout.
      */}
    </div>
  );
};

export default MainLayout;

