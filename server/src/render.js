const puppeteer = require('puppeteer');

async function renderImage({ units, dateLabel }) {
  if (!units || !units.length) {
    throw new Error('No hay unidades para generar la imagen.');
  }

  const rowHeight = 52;
  const baseHeight = 16;
  const viewportWidth = 1000;
  const height = baseHeight + units.length * rowHeight;

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: viewportWidth, height, deviceScaleFactor: 2 });

  const html = `
    <html>
      <head>
        <style>
          * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
          body { margin: 0; padding: 6px; background: #ffffff; }
          .sheet { padding: 0; }
          table { width: auto; border-collapse: collapse; margin: 0; table-layout: auto; }
          th, td { padding: 12px 12px; font-size: 16px; font-weight: 600; text-align: center; white-space: nowrap; word-break: keep-all; line-height: 1.15; }
          th { color: #f8fafc; letter-spacing: 0.06em; text-transform: uppercase; }
          td { color: #0f172a; font-weight: 600; background: #ffffff; }
          th:nth-child(1) { background: #e53935; color: #ffffff; }
          th:nth-child(2) { background: #20242c; color: #f8fafc; }
          th:nth-child(3) { background: #d6d8dc; color: #111827; }
          th:nth-child(4) { background: #eceff1; color: #111827; }
          td { border: 1px solid #d7dbe7; }
          th { border: 1px solid #d7dbe7; }
          table th:nth-child(2) { text-align: center; }
          table td:nth-child(2) { text-align: center; }
        </style>
      </head>
      <body>
        <div class="sheet">
          <table>
            <thead>
              <tr>
                <th>TRACTO</th>
                <th>OPERADOR</th>
                <th>CIUDAD DESTINO</th>
                <th>ESTADO</th>
              </tr>
            </thead>
            <tbody>
              ${units
                .map(
                  (u) => `
                  <tr>
                    <td>${escapeHtml(u.tracto)}</td>
                    <td>${escapeHtml(u.operador)}</td>
                    <td>${escapeHtml(u.ciudadDestino)}</td>
                    <td>${escapeHtml(u.estado)}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `;

  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const tableHandle = await page.$('table');
    if (!tableHandle) {
      throw new Error('No se pudo encontrar la tabla para generar la imagen.');
    }
    const buffer = await tableHandle.screenshot({ type: 'png' });
    return buffer;
  } finally {
    await browser.close();
  }
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = { renderImage };
