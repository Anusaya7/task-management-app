export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
      <img
        src="/logo.png"
        alt="Korals Design Logo"
        className="h-12 w-auto object-contain bg-black px-3 py-1.5 rounded-2xl border border-slate-700/80 shadow-md mb-6 animate-pulse"
      />
      <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-xs text-slate-400 font-medium">Loading Korals Design Workspace...</p>
    </div>
  )
}
