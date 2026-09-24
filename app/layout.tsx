import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '../src/contexts/AuthContext'

export const metadata: Metadata = {
  title: 'Task Management System',
  description: 'Role-Based Task Management System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-slate-900 text-slate-100 min-h-screen antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
