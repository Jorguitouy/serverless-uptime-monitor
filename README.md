# Uptime Jorguito 🚀

**El monitor de sitios web de código abierto, privado y seguro.**

![Uptime Status](https://img.shields.io/badge/Status-Operational-success)
![License](https://img.shields.io/badge/License-MIT-blue)
![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Cloudflare%20Workers%20%7C%20Supabase-orange)

**Uptime Jorguito** es una solución SaaS completa para monitorear el estado de tus sitios web, servidores y APIs. Diseñado para ser ultra-ligero, económico (funciona 100% en capas gratuitas) y fácil de desplegar.

---

## ✨ Características Principales

*   **🕒 Monitoreo en Tiempo Real:** Chequeos cada 1, 2, 5, 10, 15, 30 o 60 minutos.
*   **📧 Alertas Inteligentes:**
    *   Notificaciones vía Email (Resend) solo cuando el estado cambia (Caída/Recuperación).
    *   Informe detallado de duración de caída y últimos errores.
*   **🛡️ Seguridad Total:**
    *   Panel privado con autenticación.
    *   Protección de API con tokens.
    *   Sin registro público.
*   **📊 Reportes Detallados:**
    *   Historial de incidentes.
    *   Estadísticas de Uptime y Latencia (últimas 24h).
    *   Logs detallados de cada petición.
*   **🌐 Personalizable:**
    *   Nombre del panel editable.
    *   Control de indexación en buscadores (SEO).
    *   Dominio personalizado.
*   **💰 Costo Cero:**
    *   Backend: Cloudflare Workers (Gratis hasta 100k req/día).
    *   Database: Supabase (Gratis 500MB).
    *   Frontend: Cloudflare Pages (Gratis).

---

## 🚀 Guía de Instalación Paso a Paso

Sigue estos pasos para tener tu propio monitor funcionando en menos de 15 minutos.

### Prerrequisitos
*   Una cuenta en [Cloudflare](https://dash.cloudflare.com/).
*   Una cuenta en [Supabase](https://supabase.com/).
*   Una cuenta en [Resend](https://resend.com/) (para emails).
*   Node.js instalado en tu PC.

### 1. Configurar Base de Datos (Supabase)
1.  Crea un nuevo proyecto en Supabase.
2.  Ve al **SQL Editor** y ejecuta el script que encontrarás en `database/schema.sql` de este repositorio.
3.  Ve a **Project Settings > API** y copia tu `Project URL` y `anon key`.

### 2. Configurar Backend (Cloudflare Worker)
1.  Entra a la carpeta `backend`:
    ```bash
    cd backend
    npm install
    ```
2.  Renombra `wrangler.toml.example` a `wrangler.toml` (si aplica) o edítalo directamente.
3.  Sube tus credenciales secretas a Cloudflare:
    ```bash
    npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY  # Pega tu key "service_role" de Supabase
    npx wrangler secret put RESEND_API_KEY             # Pega tu API Key de Resend
    npx wrangler secret put SENDER_EMAIL               # Tu email verificado (ej: info@tudominio.com)
    npx wrangler secret put SUPABASE_URL               # Tu URL de Supabase
    ```
4.  Despliega el worker:
    ```bash
    npx wrangler deploy
    ```
5.  Copia la URL que te devuelve (ej: `https://api-uptime-jorguito...workers.dev`).

### 3. Configurar Frontend (Panel)
1.  Entra a la carpeta `frontend`:
    ```bash
    cd frontend
    npm install
    ```
2.  Crea un archivo `.env.local` y pon tus datos públicos de Supabase:
    ```env
    VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
    VITE_SUPABASE_ANON_KEY=tu-anon-key-publica
    ```
3.  Despliega a Cloudflare Pages:
    ```bash
    npm run build
    npx wrangler pages deploy dist --project-name uptime-jorguito-frontend
    ```

### 4. Configuración Final
1.  Entra a la URL de tu nuevo panel.
2.  Ve a **Configuración**.
3.  Pega la **URL del Worker** que copiaste en el paso 2.
4.  ¡Listo! Agrega tus sitios y empieza a monitorear.

---

## ☕ Apoya el Proyecto

Este proyecto es Open Source y gratuito.
Si te ha sido útil para tu negocio o proyectos personales, considera hacer una donación.
Mantener el código libre requiere tiempo y café.

[![Donate with PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://www.paypal.com/paypalme/jorgeferreirauy)

**PayPal:** `jorgeferreirauy@gmail.com`

---

## 🛠️ Tecnologías

*   **Frontend:** React, Vite, TailwindCSS, Lucide Icons.
*   **Backend:** Cloudflare Workers (Serverless).
*   **Base de Datos:** PostgreSQL (vía Supabase).
*   **Auth:** Supabase Auth.

---

*Desarrollado con ❤️ por Jorge.*
