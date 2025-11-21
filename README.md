# Sitio Portafolio (local)

Este repositorio contiene un scaffold local para ejecutar el frontend (estático) y un backend mínimo en Node.js que usa SQLite, autenticación por JWT y endpoints para gestionar videos.

Pasos rápidos para correr localmente:

1. Revoca inmediatamente cualquier token que hayas pegado en conversaciones públicas (si ya lo hiciste, perfecto).

2. Abrir un terminal y moverse al directorio `backend`:

```pwsh
Set-Location -LiteralPath "$(Resolve-Path -Path .)\backend"
npm install
npm start
```

3. Abrir el navegador en `http://localhost:3000` — la página principal es el login.

Credenciales iniciales:
- Puedes registrar un usuario desde `/api/register` usando fetch o Postman. El primer usuario puede tener rol `Manager` para administrar.

Notas de seguridad:
- Nunca pegues PATs (Personal Access Tokens) en chats públicos.
- Si pegaste algún token, revócalo desde https://github.com/settings/tokens inmediatamente.

NOTA: Si has actualizado la contraseña del usuario `amirandreve507@gmail.com` manualmente desde SQL Server Management Studio (SSMS), tras el cambio prueba el login en el backend y considera eliminar los scripts de administración (`backend/reset-password-mssql.js`, `backend/seed-admin-mssql.js`, `backend/run-seed-and-push.ps1`) del repositorio público cuando termines la configuración.
