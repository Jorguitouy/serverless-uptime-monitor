import { useState, useEffect } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Activity, Settings, LogOut, BarChart } from 'lucide-react'

export default function Layout() {
  const [siteName, setSiteName] = useState('Uptime Jorguito')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        supabase.from('settings').select('site_name, allow_indexing').eq('user_id', session.user.id).single()
          .then(({ data, error }) => {
            if (error) console.error('Error loading settings:', error);
            if (data) {
                console.log('Loading Settings:', data); // DEBUG
                if (data.site_name) {
                    setSiteName(data.site_name)
                    document.title = data.site_name;
                }
                
                // Handle Indexing
                let metaRobots = document.querySelector("meta[name='robots']");
                if (!metaRobots) {
                    metaRobots = document.createElement('meta');
                    metaRobots.name = "robots";
                    document.head.appendChild(metaRobots);
                }
                
                const newContent = data.allow_indexing ? "index, follow" : "noindex, nofollow";
                console.log('Setting robots to:', newContent); // DEBUG
                metaRobots.setAttribute('content', newContent);
            }
          })
      }
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <Link to="/" className="flex flex-shrink-0 items-center group">
                <Activity className="h-8 w-8 text-indigo-600 group-hover:text-indigo-500 transition-colors" />
                <span className="ml-2 text-xl font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">{siteName}</span>
              </Link>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  to="/"
                  className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
                >
                  Dashboard
                </Link>
                <Link
                  to="/reports"
                  className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
                >
                  Reportes
                </Link>
                <Link
                  to="/settings"
                  className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
                >
                  Configuración
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              <button
                onClick={handleLogout}
                className="rounded-full bg-white p-1 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                <span className="sr-only">Cerrar Sesión</span>
                <LogOut className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="py-10">
        <main>
          <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
