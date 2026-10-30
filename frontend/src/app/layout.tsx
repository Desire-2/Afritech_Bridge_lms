import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import ClientLayout from '@/components/layout/ClientLayout'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
})

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://study.afritechbridge.online').replace(/\/$/, '')

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1').replace(/\/$/, '')

/**
 * Server-side maintenance probe for the root layout.
 *
 * The client-side MaintenanceModeWrapper used to start in its
 * "checking" state, which meant SSR produced an empty spinner shell
 * for every route (no content, no JSON-LD in the initial HTML).
 * Knowing the flag during the server render lets us ship the real
 * page body to crawlers on the first paint while keeping the
 * client-side check as the authority for live transitions.
 * Fails open: if the probe fails, render content.
 */
async function checkMaintenance(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/maintenance/status`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { maintenance_mode?: boolean }
    return Boolean(data?.maintenance_mode)
  } catch {
    return false
  }
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'AfriTech Bridge — Instructor-led tech courses & career programs',
    template: '%s | AfriTech Bridge',
  },
  description:
    'AfriTech Bridge is an online learning platform for practical tech skills: instructor-led courses in software development, data, design and more — with flexible cohorts, scholarships and career support.',
  keywords: [
    'AfriTech Bridge',
    'online tech courses',
    'learn software development',
    'coding bootcamp',
    'data science course',
    'UI UX design course',
    'tech scholarships',
    'e-learning LMS',
  ],
  applicationName: 'AfriTech Bridge',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'AfriTech Bridge',
    title: 'AfriTech Bridge — Instructor-led tech courses & career programs',
    description:
      'Practical, instructor-led tech courses with flexible cohorts, scholarships and career support.',
    url: '/',
    images: [{ url: '/logo.jpg', alt: 'AfriTech Bridge' }],
  },
  twitter: {
    card: 'summary',
    title: 'AfriTech Bridge — Instructor-led tech courses & career programs',
    description:
      'Practical, instructor-led tech courses with flexible cohorts, scholarships and career support.',
    images: ['/logo.jpg'],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: '/favicon.ico',
  },
}

export default async function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  const maintenanceOn = await checkMaintenance()
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const html = document.documentElement;
                  html.removeAttribute('data-be-installed');
                  html.removeAttribute('foxified');
                } catch (e) {}
              })();
            `
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        <ClientLayout maintenanceOn={maintenanceOn}>
          {children}
        </ClientLayout>
      </body>
    </html>
  )
}