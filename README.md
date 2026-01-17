# DieselMaster

Aplicación web para generar solicitudes formales de diésel a partir de unidades programadas en Google Sheets.

## Requisitos
- Node.js 18+
- Cuenta de servicio con acceso a Google Sheets API v4
- Hoja de cálculo compartida con el correo de la cuenta de servicio

## Configuración del backend (`server`)
1) Instala dependencias:
   ```bash
   cd server
   npm install
   ```
2) Copia `.env.example` a `.env` y completa:
   ```env
   PORT=4000
   SPREADSHEET_ID=tu_spreadsheet_id
   SHEET_NAME=TIRO MX - IMPO (BRAYAN)
   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
   ```
3) Coloca el JSON del service account en la ruta indicada (ej. `server/service-account.json`). **No lo subas a git.**
4) Habilita Google Sheets API en el proyecto de Google Cloud y comparte la hoja con el correo del service account.

### Levantar backend
```bash
cd server
npm run dev   # con recarga por nodemon
# o
npm start
```
El API queda en `http://localhost:4000`.

## Configuración del frontend (`web`)
1) Instala dependencias:
   ```bash
   cd web
   npm install
   ```
2) (Opcional) Crea `.env` con la URL del backend si no es `http://localhost:4000`:
   ```env
   VITE_API_BASE=http://localhost:4000
   ```

### Levantar frontend
```bash
cd web
npm run dev
```
Vite expone la app en `http://localhost:5173`.

## API
- `GET /api/units?date=YYYY-MM-DD` lee Google Sheets y devuelve unidades programadas en la fecha (default: hoy).
- `POST /api/render` body `{ date, units }` devuelve un PNG con nombre `SOLICITUD_DIESEL_<fecha>.png`.

## Notas de implementación
- Encabezados requeridos: FECHA DE SALIDA, TRACTO, OPERADOR, CIUDAD DESTINO, ESTADO. Se detecta el bloque de encabezados que contenga todos.
- FECHA DE SALIDA acepta serial de Google Sheets o texto `YYYY-MM-DD` / `DD/MM/YYYY` / `MM/DD/YYYY`.
- No se filtra por estatus; solo por coincidencia exacta de fecha.
- El PNG ajusta altura a número de filas, con fuente mínima de 16px.

## Troubleshooting
- **Fecha inválida**: usa formato `YYYY-MM-DD`. Verifica zona horaria del sistema si hay desfase.
- **Sin resultados**: confirma que la hoja tiene un bloque de encabezados con todas las columnas y que la fecha coincide exactamente.
- **Permisos**: comparte la hoja con el correo del service account y confirma `SPREADSHEET_ID` correcto.
- **Puppeteer en Windows/CI**: si falla la descarga del navegador, establece `PUPPETEER_SKIP_DOWNLOAD` al instalar y configura `PUPPETEER_EXECUTABLE_PATH` a un Chrome disponible.

## Estructura
```
DieselMaster/
  server/
    src/index.js
    src/sheets.js
    src/render.js
    .env.example
    package.json
  web/
    src/App.jsx
    src/api.js
    src/main.jsx
    src/styles.css
    vite.config.js
    index.html
    package.json
  README.md
  .gitignore
```

## Smoke tests
- Backend: `npm run dev` en `server` y visitar `http://localhost:4000/api/health` debe responder `{ status: "ok" }`.
- Backend Sheets: `curl "http://localhost:4000/api/units?date=2024-01-01"` devuelve JSON o error claro.
- Render: `curl -X POST http://localhost:4000/api/render -H "Content-Type: application/json" -d '{"date":"2024-01-01","units":[{"tracto":"T1","operador":"Juan","ciudadDestino":"CDMX","estado":"Listo"}]}' > test.png` genera un PNG.
- Frontend: `npm run dev` en `web`, botón "Cargar unidades del día" trae datos; "Generar imagen (PNG)" descarga `SOLICITUD_DIESEL_<fecha>.png`.
