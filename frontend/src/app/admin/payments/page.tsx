import { Metadata } from 'next';
import PaymentsDashboard from '@/components/payments/PaymentsDashboard';

export const metadata: Metadata = {
  title: 'Payment Management | Admin Dashboard',
  description: 'Track and manage all course payments',
};

export default function AdminPaymentsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Payment Management</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Track all course payments, confirm bank transfers, and monitor payment statuses across your platform.
        </p>
      </div>
      <PaymentsDashboard role="admin" />
    </div>
  );
}
