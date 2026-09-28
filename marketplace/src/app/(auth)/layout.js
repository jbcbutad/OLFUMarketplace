export default function AuthLayout({ children }) {
  return (
    <div className="flex flex-1 items-center justify-center min-h-screen">
      {children}
    </div>
  );
}