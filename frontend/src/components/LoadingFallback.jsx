export default function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-12 h-12 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
    </div>
  );
}
