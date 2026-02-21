import { Metadata } from 'next';
import PaymentsDashboard from '@/components/payments/PaymentsDashboard';

export const metadata: Metadata = {
  title: 'Payment Tracking | Instructor Dashboard',
  description: 'Track payments for your courses',
};

export default function InstructorPaymentsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Payment Tracking</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Monitor and confirm payments for students enrolling in your courses.
        </p>
      </div>
      <PaymentsDashboard role="instructor" />
    </div>
  );
}
