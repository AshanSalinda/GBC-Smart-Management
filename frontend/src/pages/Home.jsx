import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">Home Page</h1>
      <p className="text-lg text-gray-600 mb-8">Public Marketing Page & Venue Information.</p>
      <Link to="/login" className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition">
        Go to Login
      </Link>
    </div>
  );
}
