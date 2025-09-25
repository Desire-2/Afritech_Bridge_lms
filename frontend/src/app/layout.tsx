
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'; // Import AuthProvider

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
})

export const metadata: Metadata = {
  title: 'Afritec Bridge LMS',
  description: 'Learn coding and connect with global opportunities.'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* This script helps prevent browser extensions from causing hydration mismatches */}
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              // Remove extension attributes that cause hydration errors
              const observer = new MutationObserver(function() {
                const html = document.documentElement;
                if (html.hasAttribute('data-be-installed') || html.hasAttribute('foxified')) {
                  html.removeAttribute('data-be-installed');
                  html.removeAttribute('foxified');
                }
                
                const body = document.body;
                if (body) {
                  if (body.hasAttribute('data-liner-extension-version')) {
                    body.removeAttribute('data-liner-extension-version');
                  }
                  if (body.hasAttribute('data-new-gr-c-s-check-loaded')) {
                    body.removeAttribute('data-new-gr-c-s-check-loaded');
                  }
                  if (body.hasAttribute('data-gr-ext-installed')) {
                    body.removeAttribute('data-gr-ext-installed');
                  }
                  
                  // Remove extension divs
                  const extDivs = document.querySelectorAll('.odm_extension');
                  extDivs.forEach(div => {
                    div.classList.remove('odm_extension', 'image_downloader_wrapper');
                    div.removeAttribute('data-v-7d889ae9');
                  });
                }
              });
              observer.observe(document.documentElement, { 
                attributes: true,
                childList: true,
                subtree: true,
                attributeFilter: ['data-be-installed', 'foxified', 'data-liner-extension-version',
                  'data-new-gr-c-s-check-loaded', 'data-gr-ext-installed', 'class']
              });
            })();
          `
        }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}

