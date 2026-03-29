/**
 * Auth layout — centered, no sidebar.
 * Used for /login and any other unauthenticated pages.
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {children}
    </div>
  );
}
