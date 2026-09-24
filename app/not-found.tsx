import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <h2 className="text-3xl font-extrabold text-indigo-400 mb-1">404</h2>
        <h3 className="text-base font-bold text-white mb-2">Page Not Found</h3>
        <p className="text-xs text-slate-400 mb-6">
          The requested page or route does not exist.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
        >
          Return Home
        </Link>
      </div>
    </div>
  )
}
