# Uptime Jorguito 🚀

**El monitor de sitios web de código abierto, privado y seguro.**

![Uptime Status](https://img.shields.io/badge/Status-Operational-success)
![License](https://img.shields.io/badge/License-MIT-blue)
![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Cloudflare%20Workers%20%7C%20Supabase-orange)

**Uptime Jorguito** es una solución SaaS completa para monitorear el estado de tus sitios web, servidores y APIs. Diseñado para ser ultra-ligero, económico (funciona 100% en capas gratuitas) y fácil de desplegar.

---

## ⚖️ AVISO LEGAL Y EXENCIÓN DE RESPONSABILIDAD (DISCLAIMER)

**LEA ATENTAMENTE ANTES DE UTILIZAR ESTE SOFTWARE.**

Este software, denominado "Uptime Jorguito" (en adelante, "el Software"), se proporciona con fines estrictamente **EDUCATIVOS, DE INVESTIGACIÓN Y DE ADMINISTRACIÓN DE SISTEMAS PROPIOS**.

**1. Cláusula de Exención de Responsabilidad por Uso Indebido:**
El autor, desarrollador y contribuyentes de este repositorio **DECLINAN TODA RESPONSABILIDAD** penal, civil o administrativa derivada del uso, mal uso o uso ilícito que terceros puedan dar al código fuente, binarios o documentación aquí provista. El Software ha sido diseñado exclusivamente para verificar la disponibilidad de servicios web sobre los cuales el usuario posee autorización expresa o derechos de propiedad.

**2. Prohibición de Actividades Ilícitas:**
Queda estrictamente prohibido utilizar este Software para:
*   Realizar ataques de Denegación de Servicio (DoS/DDoS).
*   Escanear, enumerar o monitorear infraestructuras de terceros sin consentimiento escrito y verificable.
*   Cualquier actividad tipificada como delito informático bajo las leyes locales o internacionales aplicables (ej: Ley de Fraude y Abuso Informático en EE.UU., Código Penal en jurisdicciones locales).

**3. Responsabilidad del Usuario Final:**
El usuario final asume **TOTAL Y EXCLUSIVA RESPONSABILIDAD** por las acciones ejecutadas con este Software. Al descargar, instalar o ejecutar este código, usted reconoce y acepta que es el único responsable de asegurar que su uso cumple con todas las leyes y regulaciones vigentes en su jurisdicción.

**4. Garantía "Tal Cual" (As-Is):**
Este Software se entrega "TAL CUAL", sin garantías de ninguna clase, expresas o implícitas, incluyendo pero no limitándose a garantías de comerciabilidad, idoneidad para un propósito particular o no infracción. En ningún caso los autores serán responsables de reclamaciones, daños u otras responsabilidades, ya sea en una acción de contrato, agravio o cualquier otro motivo, que surjan de, fuera de o en conexión con el Software o el uso u otro tipo de acciones en el Software.

---

## ✨ Características Principales

*   **🕒 Monitoreo en Tiempo Real:** Chequeos cada 1, 2, 5, 10, 15, 30 o 60 minutos.
*   **📧 Alertas Inteligentes:**
    *   Notificaciones vía Email (Resend) solo cuando el estado cambia (Caída/Recuperación).
    *   Informe detallado de duración de caída y últimos errores.
*   **🛡️ Seguridad Total:**
    *   Panel privado con autenticación y recuperación de contraseña.
    *   Protección de API con tokens de sesión.
    *   Sin registro público.
*   **📊 Reportes Detallados:**
    *   Historial de incidentes.
    *   Estadísticas de Uptime y Latencia (últimas 24h) con desglose horario.
    *   Logs detallados de cada petición (auditoría).
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

### Prerrequisitos
*   Una cuenta en [Cloudflare](https://dash.cloudflare.com/).
*   Una cuenta en [Supabase](https://supabase.com/).
*   Una cuenta en [Resend](https://resend.com/) (para emails).
*   Node.js instalado.

### 1. Configurar Base de Datos (Supabase)
1.  Crea un nuevo proyecto en Supabase.
2.  Ve al **SQL Editor** y ejecuta el script que encontrarás en `database/schema.sql` de este repositorio.
3.  Ve a **Project Settings > API** y copia tu `Project URL` y `anon key`.
4.  Ve a **Project Settings > Auth > URL Configuration** y agrega la URL de tu frontend (ej: `https://tu-dominio.com`) en "Site URL" y "Redirect URLs" para que funcione la recuperación de contraseña.

### 2. Configurar Backend (Cloudflare Worker)
1.  Entra a la carpeta `backend`:
    ```bash
    cd backend
    npm install
    ```
2.  Modifica `wrangler.toml` si quieres cambiar el nombre del worker.
3.  Sube tus credenciales secretas a Cloudflare:
    ```bash
    npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY  # Tu key "service_role" de Supabase
    npx wrangler secret put RESEND_API_KEY             # Tu API Key de Resend
    npx wrangler secret put SENDER_EMAIL               # Tu email verificado en Resend
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
2.  Crea un archivo `.env` (puedes basarte en `.env.example`):
    ```env
    VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
    VITE_SUPABASE_ANON_KEY=tu-anon-key-publica
    ```
3.  Despliega a Cloudflare Pages:
    ```bash
    npm run build
    npx wrangler pages deploy dist --project-name uptime-frontend
    ```

### 4. Configuración Final
1.  Entra a la URL de tu nuevo panel.
2.  Ve a **Configuración**.
3.  Pega la **URL del Worker** que copiaste en el paso 2.
4.  ¡Listo!

---

## 💎 Servicio de Instalación Premium

¿No tienes tiempo o conocimientos técnicos? ¡No te preocupes!
Puedo encargarme de la instalación completa y dejarte el sistema llave en mano en tu propio servidor.

**Costo:** $15 USD (Pago único).

**Pasos:**
1.  Realiza el pago seguro vía PayPal.
2.  Envíame el comprobante y acceso temporal (o credenciales API) a **jorgeferreirauy [at] gmail [dot] com**.
3.  En menos de 24 horas tendrás tu monitor funcionando.

[![Donate with PayPal](https://img.shields.io/badge/Contratar%20Servicio-PayPal-blue.svg)](https://www.paypal.com/paypalme/jorgeferreirauy)

---

## ☕ Apoya el Proyecto

Este proyecto es Open Source y gratuito. Si te ha sido útil, considera invitarme un café.
Hay días difíciles y tu apoyo significa mucho para continuar manteniendo este software.

**Donaciones:** [PayPal](https://www.paypal.com/paypalme/jorgeferreirauy)

---

*Desarrollado con ❤️ por Jorge.*
