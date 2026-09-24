'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4 font-sans">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-xl flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            !
          </div>
          <h2 className="text-lg font-bold text-white mb-2">System Error</h2>
          <p className="text-xs text-slate-400 mb-6">
            A critical system error occurred. Please try reloading the application.
          </p>
          <button
            onClick={() => reset()}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  )
}
