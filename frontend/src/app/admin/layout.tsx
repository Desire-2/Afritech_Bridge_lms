export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gray-100">
      <div className="w-64 bg-gray-800 text-white p-6 min-h-screen">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold">Admin Panel</h2>
        </div>
      </div>
      <main className="flex-1 p-6 md:p-10">
        {children}
      </main>
    </div>
  );
}