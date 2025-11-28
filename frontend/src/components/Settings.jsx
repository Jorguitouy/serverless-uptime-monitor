import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Save, AlertCircle, Send } from 'lucide-react'

export default function Settings({ session }) {
  const [settings, setSettings] = useState({
    site_name: 'Uptime Jorguito',
    allow_indexing: false,
    waf_secret: '',
    notification_email: '',
    worker_url: '',
    retention_ok_days: 1,
    retention_error_days: 30,
    alert_subject: 'ALERTA: {{site_name}} está CAÍDO',
    alert_body: '<p>El sitio <strong>{{site_name}}</strong> ({{url}}) respondió con error <strong>{{status}}</strong>.</p><p>Latencia: {{latency}}ms</p><p>Hora: {{time}}</p>'
  })
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState('')
  const [authMessage, setAuthMessage] = useState('')

  useEffect(() => {
    fetchSettings()
  }, [session])

  async function fetchSettings() {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (data) {
        setSettings(data)
      } else if (error && error.code !== 'PGRST116') {
        throw error
      } else {
        // Create default settings if not exist
        await supabase.from('settings').insert([{ user_id: session.user.id }])
        // Re-fetch to get defaults
        fetchSettings()
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          user_id: session.user.id,
          ...settings,
          updated_at: new Date().toISOString()
        })

      if (error) throw error
      setMessage('Configuración guardada correctamente.')
    } catch (error) {
      setMessage('Error al guardar: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  async function handlePasswordUpdate(e) {
      e.preventDefault()
      if (!newPassword) return
      setSaving(true)
      setAuthMessage('')
      
      try {
          const { error } = await supabase.auth.updateUser({ password: newPassword })
          if (error) throw error
          setAuthMessage('Contraseña actualizada con éxito.')
          setNewPassword('')
      } catch (error) {
          setAuthMessage('Error: ' + error.message)
      } finally {
          setSaving(false)
      }
  }

  async function sendTestEmail() {
    if (!settings.worker_url) {
      alert('Primero debes guardar la URL de tu Worker en la configuración.')
      return
    }
    if (!settings.notification_email) {
      alert('Falta configurar el email de notificaciones.')
      return
    }

    setTesting(true)
    try {
      // Clean and ensure URL has protocol
      let url = settings.worker_url.trim()
      
      // Remove protocol if present to standardize
      url = url.replace(/^https?:\/\//, '')
      
      // Remove trailing slash
      if (url.endsWith('/')) {
        url = url.slice(0, -1)
      }
      
      // Add secure protocol
      url = 'https://' + url

      const response = await fetch(`${url}/test-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          notification_email: settings.notification_email
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al enviar email')
      }

      alert('Email de prueba enviado correctamente! Revisa tu bandeja de entrada.')
    } catch (error) {
      alert('Error: ' + error.message)
    } finally {
      setTesting(false)
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setSettings(prev => ({ ...prev, [name]: value }))
  }

  if (loading) return <div className="text-center mt-10">Cargando configuración...</div>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white shadow sm:rounded-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Configuración del Sistema</h2>
        
        {/* Account Section */}
        <div className="mb-10 border-b pb-8">
            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Mi Cuenta</h3>
            <form onSubmit={handlePasswordUpdate} className="flex items-end gap-4">
                <div className="flex-grow max-w-sm">
                    <label className="block text-sm font-medium text-gray-700">Nueva Contraseña</label>
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                        placeholder="Escribe para cambiar..."
                    />
                </div>
                <button
                    type="submit"
                    disabled={!newPassword || saving}
                    className="inline-flex justify-center rounded-md border border-transparent bg-gray-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-gray-700 focus:outline-none disabled:opacity-50"
                >
                    Actualizar Contraseña
                </button>
            </form>
            {authMessage && <p className="mt-2 text-sm text-indigo-600">{authMessage}</p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Credentials Section */}
          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900 border-b pb-2 mb-4">Personalización</h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre del Panel</label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="site_name"
                    value={settings.site_name || ''}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                    placeholder="Mi Monitor"
                  />
                </div>
              </div>
              <div className="flex items-center">
                <div className="flex items-center h-5">
                  <input
                    id="allow_indexing"
                    name="allow_indexing"
                    type="checkbox"
                    checked={settings.allow_indexing || false}
                    onChange={(e) => setSettings({ ...settings, allow_indexing: e.target.checked })}
                    className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="allow_indexing" className="font-medium text-gray-700">Indexar en Buscadores</label>
                  <p className="text-gray-500">Permitir que Google y otros robots indexen este panel.</p>
                </div>
              </div>
            </div>

            <h3 className="text-lg font-medium leading-6 text-gray-900 border-b pb-2 mb-4">Credenciales y API Keys</h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Worker URL</label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="worker_url"
                    value={settings.worker_url || ''}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                    placeholder="https://uptime-jorguito.tu-usuario.workers.dev"
                  />
                  <p className="mt-1 text-xs text-gray-500">Necesaria para enviar pruebas de email.</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">WAF Secret Header</label>
                <div className="mt-1">
                  <input
                    type="password"
                    name="waf_secret"
                    value={settings.waf_secret || ''}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                    placeholder="X-Monitor-Secret Value"
                  />
                  <p className="mt-1 text-xs text-gray-500">Se enviará como header en cada request.</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email Notificaciones</label>
                <div className="mt-1">
                  <input
                    type="email"
                    name="notification_email"
                    value={settings.notification_email || ''}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                    placeholder="tu@email.com"
                  />
                </div>
              </div>
            </div>

            {/* Retention Section */}
            <h3 className="text-lg font-medium leading-6 text-gray-900 border-b pb-2 mb-4 mt-6">Retención de Logs</h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Retención Logs "OK" (Días)</label>
                <div className="mt-1">
                  <input
                    type="number"
                    name="retention_ok_days"
                    min="1"
                    max="365"
                    value={settings.retention_ok_days || 1}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  />
                  <p className="mt-1 text-xs text-gray-500">Días a guardar registros de chequeos exitosos.</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Retención Logs "Error" (Días)</label>
                <div className="mt-1">
                  <input
                    type="number"
                    name="retention_error_days"
                    min="1"
                    max="365"
                    value={settings.retention_error_days || 30}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  />
                  <p className="mt-1 text-xs text-gray-500">Días a guardar registros de fallos/errores.</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
               <button
                type="button"
                onClick={sendTestEmail}
                disabled={testing || saving}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
              >
                <Send className="mr-2 h-4 w-4 text-gray-500" />
                {testing ? 'Enviando...' : 'Probar Envío de Email'}
              </button>
            </div>
          </div>

          {/* Email Template Section */}
          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900 border-b pb-2 mb-4">Plantilla de Alerta</h3>
            <div className="rounded-md bg-blue-50 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-blue-400" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">Variables Disponibles</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>Puedes usar estas variables en el asunto y cuerpo del correo:</p>
                    <ul className="list-disc list-inside mt-1 font-mono text-xs">
                      <li>{'{{site_name}}'} - Nombre del sitio</li>
                      <li>{'{{url}}'} - URL del sitio</li>
                      <li>{'{{status}}'} - Código de estado HTTP (o Network Error)</li>
                      <li>{'{{latency}}'} - Tiempo de respuesta en ms</li>
                      <li>{'{{time}}'} - Hora del incidente</li>
                      <li>{'{{error}}'} - Mensaje de error técnico</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Asunto del Correo</label>
                <input
                  type="text"
                  name="alert_subject"
                  value={settings.alert_subject || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Cuerpo del Correo (HTML)</label>
                <textarea
                  name="alert_body"
                  rows={6}
                  value={settings.alert_body || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <div className="pt-5 border-t border-gray-200">
            <div className="flex justify-end">
              {message && <span className="mr-4 text-sm text-green-600 self-center">{message}</span>}
              <button
                type="submit"
                disabled={saving}
                className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                <Save className="mr-2 h-5 w-5" />
                {saving ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
