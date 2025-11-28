import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, PauseCircle, PlayCircle, Globe, Clock, Activity, Edit2, X, AlertTriangle } from 'lucide-react'

export default function Dashboard({ session }) {
  const [sites, setSites] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({ id: null, name: '', url: '', interval: 60 })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [checkingId, setCheckingId] = useState(null)
  const [settings, setSettings] = useState(null)

  useEffect(() => {
      // Fetch settings to get worker URL
      supabase.from('settings').select('worker_url').eq('user_id', session.user.id).single()
        .then(({ data }) => setSettings(data));
  }, [session]);

  useEffect(() => {
    fetchSites()
    // Poll for updates every 10 seconds
    const interval = setInterval(fetchSites, 10000)
    return () => clearInterval(interval)
  }, [session])

  async function fetchSites() {
    try {
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setSites(data || [])
    } catch (error) {
      console.error('Error loading sites:', error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!formData.url || !formData.name) return

    // Check for duplicates and related domains (only for new sites)
    if (!formData.id) {
        try {
            const newHostname = new URL(formData.url).hostname.replace(/^www\./, '');
            
            const relatedSites = sites.filter(s => {
                try {
                    const existingHostname = new URL(s.url).hostname.replace(/^www\./, '');
                    return newHostname.includes(existingHostname) || existingHostname.includes(newHostname);
                } catch (e) {
                    return false;
                }
            });

            if (relatedSites.length > 0) {
                const siteList = relatedSites.map(s => `- ${s.url}`).join('\n');
                const message = `Atención: Ya tienes monitores relacionados con este dominio:\n${siteList}\n\n¿Estás seguro de que quieres agregar ${formData.url}?`;
                
                if (!confirm(message)) {
                    return;
                }
            }
        } catch (e) {
            // Invalid URL format, let it pass to database validation or next step
        }
    }

    try {
      setIsSubmitting(true)
      const user = session.user
      
      if (formData.id) {
        // Update existing
        const { error } = await supabase
          .from('sites')
          .update({
            url: formData.url,
            name: formData.name,
            check_interval: parseInt(formData.interval)
          })
          .eq('id', formData.id)
        if (error) throw error
      } else {
        // Create new
        const { error } = await supabase
          .from('sites')
          .insert([{ 
            user_id: user.id,
            url: formData.url,
            name: formData.name,
            check_interval: parseInt(formData.interval)
          }])
        if (error) throw error
      }
      
      resetForm()
      fetchSites()
    } catch (error) {
      alert(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function editSite(site) {
    setFormData({
      id: site.id,
      name: site.name,
      url: site.url,
      interval: site.check_interval
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setFormData({ id: null, name: '', url: '', interval: 60 })
  }

  async function deleteSite(id) {
    if (!confirm('¿Estás seguro de borrar este sitio?')) return
    try {
      const { error } = await supabase.from('sites').delete().eq('id', id)
      if (error) throw error
      setSites(sites.filter(s => s.id !== id))
    } catch (error) {
      console.error(error)
    }
  }

  async function toggleStatus(id, currentStatus) {
    try {
      const { error } = await supabase
        .from('sites')
        .update({ is_active: !currentStatus })
        .eq('id', id)
      
      if (error) throw error
      fetchSites()
    } catch (error) {
      console.error(error)
    }
  }

  async function manualCheck(site) {
      if (!settings?.worker_url) {
          alert('Configura la URL del Worker en Settings primero.');
          return;
      }
      
      setCheckingId(site.id);
      try {
          let url = settings.worker_url.trim();
          url = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
          url = 'https://' + url;

          const response = await fetch(`${url}/check-site`, {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({ site_id: site.id })
          });
          
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Error en chequeo');

          alert(`Chequeo completado.\nStatus: ${result.status}\nLatencia: ${result.latency}ms`);
          fetchSites();
      } catch (e) {
          alert('Error al chequear: ' + e.message);
      } finally {
          setCheckingId(null);
      }
  }

  async function acknowledgeIncident(id) {
    try {
      const { error } = await supabase
        .from('sites')
        .update({ incident_acknowledged_at: new Date().toISOString() })
        .eq('id', id)
      
      if (error) throw error
      fetchSites()
    } catch (error) {
      console.error(error)
    }
  }

  if (loading) return <div className="text-center mt-10">Cargando monitores...</div>

  // Filtrar SOLO por URL (Dominio)
  const filteredSites = sites.filter(site => 
    site.url.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Add/Edit Site Form */}
      <div className={`bg-white shadow sm:rounded-lg p-6 ${formData.id ? 'ring-2 ring-indigo-500' : ''}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            {formData.id ? 'Editar Monitor' : 'Agregar Nuevo Monitor'}
          </h3>
          {formData.id && (
            <button onClick={resetForm} className="text-sm text-gray-500 hover:text-gray-700 flex items-center">
              <X className="h-4 w-4 mr-1" /> Cancelar Edición
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nombre</label>
            <input
              type="text"
              id="name"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
              placeholder="Mi Sitio Web"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700">URL</label>
            <input
              type="url"
              id="url"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
              placeholder="https://example.com"
              value={formData.url}
              onChange={(e) => setFormData({...formData, url: e.target.value})}
              required
            />
          </div>
          <div>
            <label htmlFor="interval" className="block text-sm font-medium text-gray-700">Intervalo</label>
            <select
              id="interval"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
              value={formData.interval}
              onChange={(e) => setFormData({...formData, interval: e.target.value})}
            >
              <option value="60">1 Minuto</option>
              <option value="120">2 Minutos</option>
              <option value="300">5 Minutos</option>
              <option value="600">10 Minutos</option>
              <option value="900">15 Minutos</option>
              <option value="1800">30 Minutos</option>
              <option value="3600">1 Hora</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`inline-flex w-full justify-center rounded-md border border-transparent px-4 py-2 text-base font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm ${formData.id ? 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500' : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'}`}
            >
              {formData.id ? <><Edit2 className="mr-2 h-5 w-5" /> Actualizar</> : <><Plus className="mr-2 h-5 w-5" /> Agregar</>}
            </button>
          </div>
        </form>
      </div>

      {/* Search Bar */}
      <div className="flex justify-end">
        <input
          type="text"
          placeholder="Buscar por dominio..."
          className="block w-full sm:w-64 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Sites Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredSites.map((site) => {
          const isUp = site.last_status >= 200 && site.last_status < 300
          const statusColor = isUp ? 'bg-green-100 text-green-800' : (site.last_status === null ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800')
          const statusText = site.last_status ? (isUp ? 'OPERATIVO' : `ERROR ${site.last_status}`) : 'PENDIENTE'

          // Incident Logic
          let hasRecentIncident = false;
          if (site.last_incident_at) {
            const incidentDate = new Date(site.last_incident_at);
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            
            if (incidentDate > sevenDaysAgo) {
               // Check if acknowledged
               if (!site.incident_acknowledged_at || new Date(site.incident_acknowledged_at) < incidentDate) {
                   hasRecentIncident = true;
               }
            }
          }

          return (
            <div key={site.id} className={`relative flex flex-col overflow-hidden rounded-lg bg-white shadow transition-all hover:shadow-md ${hasRecentIncident ? 'ring-2 ring-red-500' : ''}`}>
              {hasRecentIncident && (
                <div className="bg-red-500 text-white text-xs px-2 py-1 text-center font-bold flex justify-center items-center">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Incidente Reciente (7d)
                </div>
              )}
              <div className="flex-1 p-6">
                <div className="flex items-center justify-between">
                  <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
                    {statusText}
                  </div>
                  <span className="text-xs text-gray-500">
                    {site.is_active ? 'Activo' : 'Pausado'}
                  </span>
                </div>
                
                <h3 className="mt-4 text-lg font-medium text-gray-900 flex items-center">
                  <Globe className="h-4 w-4 mr-2 text-gray-400" />
                  {site.name}
                </h3>
                <p className="mt-1 text-sm text-gray-500 truncate" title={site.url}>{site.url}</p>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div>
                    <dt className="flex items-center text-sm font-medium text-gray-500">
                      <Activity className="h-4 w-4 mr-1" /> Latencia
                    </dt>
                    <dd className="mt-1 text-2xl font-semibold text-gray-900">
                      {site.last_latency ? `${site.last_latency}ms` : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center text-sm font-medium text-gray-500">
                      <Clock className="h-4 w-4 mr-1" /> Último Check
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {site.last_checked_at ? new Date(site.last_checked_at).toLocaleTimeString() : '-'}
                    </dd>
                    <dd className="text-xs text-gray-400 mt-1">
                      (Cada {site.check_interval < 60 ? `${site.check_interval}s` : `${Math.round(site.check_interval / 60)}m`})
                    </dd>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-3 flex justify-between items-center border-t border-gray-100">
                <div className="flex space-x-2">
                  <button
                    onClick={() => toggleStatus(site.id, site.is_active)}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500 flex items-center px-2"
                    title={site.is_active ? "Pausar" : "Reanudar"}
                  >
                    {site.is_active ? <PauseCircle className="h-5 w-5" /> : <PlayCircle className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={() => editSite(site)}
                    className="text-sm font-medium text-orange-600 hover:text-orange-500 flex items-center px-2"
                    title="Editar"
                  >
                    <Edit2 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => manualCheck(site)}
                    disabled={checkingId === site.id}
                    className={`text-sm font-medium flex items-center px-2 ${checkingId === site.id ? 'text-gray-400' : 'text-blue-600 hover:text-blue-500'}`}
                    title="Chequear Ahora"
                  >
                    <Activity className={`h-5 w-5 ${checkingId === site.id ? 'animate-pulse' : ''}`} />
                  </button>
                </div>
                
                <div className="flex space-x-2 items-center">
                  {hasRecentIncident && (
                    <button
                        onClick={() => acknowledgeIncident(site.id)}
                        className="text-xs font-medium text-gray-600 hover:text-gray-800 bg-gray-200 px-2 py-1 rounded hover:bg-gray-300 transition-colors"
                    >
                        Limpiar Alerta
                    </button>
                  )}
                  <button
                    onClick={() => deleteSite(site.id)}
                    className="text-sm font-medium text-red-600 hover:text-red-500 flex items-center px-2"
                    title="Eliminar"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      
      {sites.length === 0 && !loading && (
        <div className="text-center py-12">
          <Activity className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No hay monitores</h3>
          <p className="mt-1 text-sm text-gray-500">Empieza agregando tu primer sitio web para monitorear.</p>
        </div>
      )}
    </div>
  )
}
