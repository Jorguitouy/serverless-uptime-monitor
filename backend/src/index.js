import { createClient } from '@supabase/supabase-js';

export default {
  // Manejo de peticiones HTTP
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Root endpoint check
    if (request.method === 'GET' && url.pathname === '/') {
      return new Response('Uptime Jorguito Worker is RUNNING 🚀', {
        status: 200,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders }
      });
    }

    // Manual Global Trigger (Depuración)
    if (request.method === 'GET' && url.pathname === '/trigger-check') {
      try {
        const result = await checkSites(env);
        return new Response(JSON.stringify(result, null, 2), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // Check Single Site (Manual Run)
    if (request.method === 'POST' && url.pathname === '/check-site') {
      // Auth Check
      const authHeader = request.headers.get('Authorization');
      if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      
      const token = authHeader.replace('Bearer ', '');
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) return new Response(JSON.stringify({ error: 'Invalid Token' }), { status: 401, headers: corsHeaders });

      try {
        const body = await request.json();
        const { site_id } = body;
        if (!site_id) throw new Error('Missing site_id');

        const result = await checkSingleSite(env, site_id);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // Test Email Endpoint
    if (request.method === 'POST' && url.pathname === '/test-email') {
      // Auth Check
      const authHeader = request.headers.get('Authorization');
      if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      
      const token = authHeader.replace('Bearer ', '');
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) return new Response(JSON.stringify({ error: 'Invalid Token' }), { status: 401, headers: corsHeaders });

      try {
        const body = await request.json();
        const { notification_email } = body;
        const resend_api_key = env.RESEND_API_KEY;
        const sender_email = env.SENDER_EMAIL;

        if (!resend_api_key || !sender_email || !notification_email) {
          return new Response(JSON.stringify({ error: 'Faltan credenciales o email' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resend_api_key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: sender_email,
            to: notification_email,
            subject: 'Prueba de Configuración - Uptime Jorguito',
            html: '<p>¡Configuración correcta!</p>'
          })
        });

        const data = await res.json();
        return new Response(JSON.stringify(data), { 
          status: res.ok ? 200 : res.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkSites(env));
  }
};

// Check a single site manually (ignoring schedule)
async function checkSingleSite(env, site_id) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  // Get site
  const { data: site, error } = await supabase.from('sites').select('*').eq('id', site_id).single();
  if (error || !site) throw new Error('Site not found');

  // Get Settings
  const { data: settings } = await supabase.from('settings').select('*').eq('user_id', site.user_id).single();
  
  // Process
  return await processSite(site, settings || {}, env, supabase, true); // true = manual run
}

async function checkSites(env) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  
  const { data: sites, error: sitesError } = await supabase
    .from('sites')
    .select('*')
    .eq('is_active', true)
    .lte('next_run_at', new Date().toISOString());

  if (sitesError) throw new Error('Database Error (Sites): ' + sitesError.message);
  
  // System Recovery Check
  if (sites && sites.length > 0) {
      const now = Date.now();
      let minGapMinutes = 999999;
      sites.forEach(s => {
          if (s.last_checked_at) {
              const gap = (now - new Date(s.last_checked_at).getTime()) / 60000;
              if (gap < minGapMinutes) minGapMinutes = gap;
          }
      });
      if (minGapMinutes > 15 && minGapMinutes < 999999) {
          const recoveryMsg = `El sistema de monitoreo se ha recuperado tras aprox. ${Math.round(minGapMinutes)} minutos de inactividad global.`;
          const userIds = [...new Set(sites.map(s => s.user_id))];
          const { data: settingsData } = await supabase.from('settings').select('user_id, notification_email').in('user_id', userIds);
          const settingsMap = {};
          if(settingsData) settingsData.forEach(s => settingsMap[s.user_id] = s);
          const notifiedAdmins = new Set();
          for (const uid of userIds) {
              if (notifiedAdmins.has(uid)) continue;
              notifiedAdmins.add(uid);
              await supabase.from('system_events').insert({ user_id: uid, event_type: 'system_recovery', message: recoveryMsg });
              const userSettings = settingsMap[uid];
              if (userSettings && userSettings.notification_email && env.RESEND_API_KEY && env.SENDER_EMAIL) {
                  await sendSystemAlert(userSettings.notification_email, recoveryMsg, env);
              }
          }
      }
  }

  if (!sites || sites.length === 0) return { message: 'No sites due', timestamp: new Date().toISOString() };

  const userIds = [...new Set(sites.map(s => s.user_id))];
  const { data: settingsData, error: settingsError } = await supabase
    .from('settings')
    .select('user_id, waf_secret, notification_email, alert_subject, alert_body, retention_ok_days, retention_error_days')
    .in('user_id', userIds);

  if (settingsError) throw new Error('Database Error (Settings): ' + settingsError.message);

  const settingsMap = {};
  settingsData.forEach(s => settingsMap[s.user_id] = s);

  const results = await Promise.allSettled(sites.map(async (site) => {
    return await processSite(site, settingsMap[site.user_id] || {}, env, supabase, false);
  }));

  await cleanupLogs(supabase, settingsData);
  
  return { 
    processed: results.length, 
    details: results.map(r => r.status === 'fulfilled' ? r.value : r.reason) 
  };
}

async function processSite(site, settings, env, supabase, isManual) {
    const canNotify = env.RESEND_API_KEY && env.SENDER_EMAIL && settings.notification_email;
    const startTime = Date.now();
    let status = 0;
    let errorMsg = null;
    
    try {
      const headers = { 'User-Agent': 'UptimeMonitor/1.0' };
      if (settings.waf_secret) headers['X-Monitor-Secret'] = settings.waf_secret;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(site.url, {
        method: 'HEAD',
        headers: headers,
        redirect: 'follow',
        signal: controller.signal,
        cf: { cacheTtl: 0 }
      });
      clearTimeout(timeout);
      status = response.status;
    } catch (e) {
      status = 0; 
      errorMsg = e.message;
    }

    const latency = Date.now() - startTime;
    const isUp = status >= 200 && status < 300;
    const wasUp = site.last_status >= 200 && site.last_status < 300;
    
    let statusChanged = false;
    if (site.last_status === null) {
        if (!isUp) statusChanged = true;
    } else {
        statusChanged = isUp !== wasUp;
    }
    
    let statusChangedAt = site.status_changed_at;
    let lastIncidentAt = site.last_incident_at;

    if (statusChanged) {
        statusChangedAt = new Date().toISOString();
        if (!isUp) lastIncidentAt = new Date().toISOString();
    } else if (!statusChangedAt) {
        statusChangedAt = new Date().toISOString();
    }

    const bufferSeconds = 5;
    const intervalSeconds = site.check_interval || 60;
    const adjustedInterval = Math.max(10, intervalSeconds - bufferSeconds);
    const nextRun = new Date(Date.now() + (adjustedInterval * 1000));

    await supabase.from('sites').update({
      last_status: status,
      last_latency: latency,
      last_checked_at: new Date().toISOString(),
      status_changed_at: statusChangedAt,
      last_incident_at: lastIncidentAt,
      next_run_at: nextRun.toISOString()
    }).eq('id', site.id);

    await supabase.from('ping_logs').insert({
      site_id: site.id,
      status_code: status,
      latency_ms: latency
    });

    if (statusChanged && canNotify) {
       let errorReport = [];
       let durationStr = '';
       if (isUp && site.status_changed_at) {
           const downStart = new Date(site.status_changed_at);
           const diffMs = Date.now() - downStart.getTime();
           const minutes = Math.round(diffMs / 60000);
           durationStr = `${minutes} minutos`;
           const { data: logs } = await supabase.from('ping_logs').select('created_at, status_code').eq('site_id', site.id).gte('created_at', site.status_changed_at).or('status_code.lt.200,status_code.gte.300').order('created_at', { ascending: false }).limit(5);
           errorReport = logs || [];
       }
       await sendAlert(site, settings, status, isUp, durationStr, errorMsg, errorReport, env);
    }
    
    return { id: site.id, url: site.url, status, latency, manual: isManual };
}

async function sendAlert(site, settings, status, isUp, durationStr, errorMsg, errorReport, env) {
  let subject = '';
  let body = '';
  if (isUp) {
      subject = `✅ RECUPERADO: ${site.name} está ONLINE`;
      let errorListHtml = '';
      if (errorReport && errorReport.length > 0) {
          errorListHtml = '<h4>Últimos errores registrados:</h4><ul>' + errorReport.map(l => `<li>${new Date(l.created_at).toLocaleTimeString()}: Status ${l.status_code}</li>`).join('') + '</ul>';
      }
      body = `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;"><h2 style="color: #10b981;">✅ Sitio Recuperado</h2><p>El sitio <strong>${site.name}</strong> (<a href="${site.url}">${site.url}</a>) ha vuelto a estar operativo.</p><div style="background: #f9fafb; padding: 15px; border-radius: 5px; margin: 20px 0;"><p><strong>Tiempo de inactividad:</strong> ${durationStr || 'Desconocido'}</p><p><strong>Estado actual:</strong> ${status} (OK)</p></div>${errorListHtml}<p style="font-size: 12px; color: #6b7280; margin-top: 20px;">Monitoreado por Uptime Jorguito</p></div>`;
  } else {
      subject = (settings.alert_subject || 'ALERTA: {{site_name}} está CAÍDO').replace('{{site_name}}', site.name).replace('{{status}}', status);
      const rawBody = (settings.alert_body || '<p>El sitio {{url}} respondió con error {{status}}</p>').replace('{{site_name}}', site.name).replace('{{url}}', site.url).replace('{{status}}', status).replace('{{error}}', errorMsg || '').replace('{{time}}', new Date().toISOString());
      body = `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #fee2e2; border-radius: 5px;"><h2 style="color: #ef4444;">🚨 Alerta de Caída</h2>${rawBody}<p style="font-size: 12px; color: #6b7280; margin-top: 20px;">Monitoreado por Uptime Jorguito</p></div>`;
  }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.SENDER_EMAIL, to: settings.notification_email, subject: subject, html: body })
    });
  } catch (e) { console.error('Alert Error:', e); }
}

async function sendSystemAlert(email, message, env) {
    try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST', headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: env.SENDER_EMAIL, to: email, subject: '⚠️ Aviso del Sistema de Monitoreo', html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #fcd34d; border-radius: 5px; background-color: #fffbeb;"><h2 style="color: #b45309;">Aviso de Infraestructura</h2><p>${message}</p><p>Esto indica que el Worker de Cloudflare dejó de ejecutarse temporalmente y se acaba de reiniciar automáticamente.</p></div>` })
        });
      } catch (e) { console.error('System Alert Error:', e); }
}

async function cleanupLogs(supabase, settingsList) {
  if (!settingsList || settingsList.length === 0) return;
  await Promise.all(settingsList.map(async (setting) => {
    const { retention_ok_days = 1, retention_error_days = 30, user_id } = setting;
    const dateOK = new Date(Date.now() - (retention_ok_days || 1) * 24 * 60 * 60 * 1000).toISOString();
    const dateError = new Date(Date.now() - (retention_error_days || 30) * 24 * 60 * 60 * 1000).toISOString();
    await supabase.rpc('delete_old_logs', { p_user_id: user_id, p_date_ok: dateOK, p_date_error: dateError });
  }));
}
