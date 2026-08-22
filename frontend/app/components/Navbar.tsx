import Link from "next/link";

export default function Navbar() {
  return (
    <div className="w-full px-6 pt-5">
      <nav className="flex items-center justify-between px-6 py-3 rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Logo - Left */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-gray-900">
            Care<span className="text-blue-600">Matrix</span>
          </span>
        </Link>

        {/* Auth Buttons - Right */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign Up
          </Link>
        </div>
      </nav>
    </div>
  );
}
