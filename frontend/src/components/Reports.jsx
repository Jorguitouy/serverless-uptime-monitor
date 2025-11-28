import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react'

export default function Reports({ session }) {
  const [incidents, setIncidents] = useState([])
  const [stats, setStats] = useState([])
  const [detailedLogs, setDetailedLogs] = useState([])
  const [systemEvents, setSystemEvents] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('incidents')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      
      // 1. Fetch Incident History (Last 30 days errors)
      const { data: errorLogs, error: error1 } = await supabase
        .from('ping_logs')
        .select('*, sites(name, url)')
        .or('status_code.lt.200,status_code.gte.300')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error1) throw error1
      setIncidents(errorLogs)

      // 2. Fetch 24h Stats (Client-side calculation from available logs)
      const { data: allLogs, error: error2 } = await supabase
        .from('ping_logs')
        .select('*, sites(id, name, url)')
        .order('created_at', { ascending: false })
      
      if (error2) throw error2

      setDetailedLogs(allLogs)

      // 3. Fetch System Events (Last 20)
      const { data: sysEvents, error: error3 } = await supabase
        .from('system_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      
      if (!error3) setSystemEvents(sysEvents)

      // Group by site
      const siteStats = {}
      allLogs.forEach(log => {
        if (!log.sites) return
        const siteId = log.sites.id
        if (!siteStats[siteId]) {
          siteStats[siteId] = {
            id: siteId,
            name: log.sites.name,
            url: log.sites.url,
            total: 0,
            ok: 0,
            totalLatency: 0,
            countLatency: 0
          }
        }
        
        siteStats[siteId].total++
        if (log.status_code >= 200 && log.status_code < 300) {
          siteStats[siteId].ok++
          siteStats[siteId].totalLatency += log.latency_ms
          siteStats[siteId].countLatency++
        }
      })

      // Process Stats & Hourly
      const statsArray = Object.values(siteStats).map(s => {
        // Calculate basic stats
        const uptime = ((s.ok / s.total) * 100).toFixed(1);
        const avgLatency = s.countLatency > 0 ? Math.round(s.totalLatency / s.countLatency) : 0;

        // Calculate Hourly Breakdown
        const hourlyMap = {};
        const now = new Date();
        // Initialize map with last 24 hours
        for(let i=0; i<24; i++) {
           const d = new Date(now.getTime() - i * 60 * 60 * 1000);
           const key = d.toISOString().slice(0, 13); // YYYY-MM-DDTHH
           hourlyMap[key] = { total: 0, ok: 0, date: d };
        }

        // Fill with log data
        allLogs.filter(l => l.site_id === s.id).forEach(log => {
           const key = new Date(log.created_at).toISOString().slice(0, 13);
           if (hourlyMap[key]) {
             hourlyMap[key].total++;
             if (log.status_code >= 200 && log.status_code < 300) {
               hourlyMap[key].ok++;
             }
           }
        });

        const hourly = Object.values(hourlyMap)
          .sort((a, b) => a.date - b.date)
          .map(h => ({
            hour: h.date.getHours() + ':00',
            uptime: h.total > 0 ? Math.round((h.ok / h.total) * 100) : null // null = no data
          }));

        return { ...s, uptime, avgLatency, hourly };
      })

      setStats(statsArray)

    } catch (error) {
      console.error('Error fetching reports:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter logic (Only by Domain/URL)
  const filteredIncidents = incidents.filter(log => 
    log.sites?.url.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredStats = stats.filter(site => 
    (site.url && site.url.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const filteredLogs = detailedLogs.filter(log => 
    log.sites?.url.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="w-full sm:w-auto">
          <div className="sm:hidden">
            <select
              className="block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
            >
              <option value="incidents">Incidentes</option>
              <option value="stats">Estadísticas (24h)</option>
            </select>
          </div>
          <div className="hidden sm:block">
            <nav className="flex space-x-4" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('incidents')}
                className={`${activeTab === 'incidents' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-700'} px-3 py-2 rounded-md text-sm font-medium`}
              >
                Historial de Incidentes
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`${activeTab === 'stats' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-700'} px-3 py-2 rounded-md text-sm font-medium`}
              >
                Estadísticas (Últimas 24h)
              </button>
              <button
                onClick={() => setActiveTab('system')}
                className={`${activeTab === 'system' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-700'} px-3 py-2 rounded-md text-sm font-medium`}
              >
                Logs de Sistema
              </button>
            </nav>
          </div>
        </div>
        
        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Buscar por dominio..."
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10">Cargando reportes...</div>
      ) : (
        <>
          {activeTab === 'incidents' && (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {filteredIncidents.length === 0 ? (
                  <li className="p-4 text-center text-gray-500">No se encontraron incidentes.</li>
                ) : (
                  filteredIncidents.map((log) => (
                    <li key={log.id}>
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-indigo-600 truncate">
                            {log.sites?.name} <span className='text-gray-400 text-xs'>({log.sites?.url})</span>
                          </p>
                          <div className="ml-2 flex-shrink-0 flex">
                            <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                              Status {log.status_code}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 sm:flex sm:justify-between">
                          <div className="sm:flex">
                            <p className="flex items-center text-sm text-gray-500">
                              <AlertTriangle className="flex-shrink-0 mr-1.5 h-5 w-5 text-red-400" />
                              Error detectado
                            </p>
                          </div>
                          <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                            <Clock className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                            <p>
                              {new Date(log.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Eventos del Sistema</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Registro de alertas de infraestructura (caídas del worker, reinicios, etc).</p>
              </div>
              <ul className="divide-y divide-gray-200">
                {systemEvents.length === 0 ? (
                  <li className="p-4 text-center text-gray-500">No hay eventos de sistema registrados.</li>
                ) : (
                  systemEvents.map((evt) => (
                    <li key={evt.id} className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <AlertTriangle className="h-5 w-5 text-yellow-500 mr-3" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {evt.event_type === 'system_recovery' ? 'Recuperación del Sistema' : evt.event_type}
                            </p>
                            <p className="text-sm text-gray-500">{evt.message}</p>
                          </div>
                        </div>
                        <div className="ml-2 flex-shrink-0 flex flex-col items-end">
                          <p className="text-sm text-gray-500">
                            {new Date(evt.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredStats.map((site, idx) => (
                  <div key={idx} className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            {parseFloat(site.uptime) > 99 ? (
                              <CheckCircle className="h-6 w-6 text-green-400" />
                            ) : (
                              <AlertTriangle className="h-6 w-6 text-yellow-400" />
                            )}
                          </div>
                        <div className="ml-5 overflow-hidden">
                          <h3 className="text-lg font-medium leading-6 text-gray-900 truncate" title={site.name}>{site.name}</h3>
                          <a href={site.url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:text-indigo-500 truncate block" title={site.url}>{site.url}</a>
                          <p className="text-sm text-gray-500 mt-1">Promedio Latencia: {site.avgLatency}ms | Uptime Global: {site.uptime}%</p>
                        </div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 px-5 py-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Uptime por Hora (Últimas 24h)</h4>
                      <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
                        {site.hourly.map((h, i) => (
                          <div key={i} className="flex flex-col items-center">
                            <div 
                              className={`w-full h-8 rounded-sm ${h.uptime === null ? 'bg-gray-200' : (h.uptime === 100 ? 'bg-green-400' : (h.uptime > 90 ? 'bg-yellow-400' : 'bg-red-400'))}`} 
                              title={`${h.hour}: ${h.uptime !== null ? h.uptime + '%' : 'No data'}`}
                            ></div>
                            <span className="text-[10px] text-gray-400 mt-1">{i % 3 === 0 ? h.hour : ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Detailed Logs Table */}
              <div>
                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Detalle de Peticiones (Últimas 24h)</h3>
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                  <div className="overflow-x-auto max-h-[600px]">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sitio</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Latencia</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(log.created_at).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              <a href={log.sites?.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600">
                                {log.sites?.url}
                              </a>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${log.status_code >= 200 && log.status_code < 300 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {log.status_code}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {log.latency_ms}ms
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
