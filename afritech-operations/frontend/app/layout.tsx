import type { Metadata } from 'next';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import BootstrapJS from '@/components/bootstrap';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'AfriTech Bridge Operations',
  description: 'Internal business management system for AfriTech Bridge',
  icons: {
    icon: '/logo.jpg',
    apple: '/logo.jpg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <BootstrapJS />
          <Toaster position="top-right" richColors closeButton />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}