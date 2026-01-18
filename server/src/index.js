require('dotenv').config();
const express = require('express');
const cors = require('cors');
const dayjs = require('dayjs');
const { google } = require('googleapis');
const { GoogleAuth } = google.auth;
const { fetchUnits } = require('./sheets');
const { renderImage } = require('./render');

const app = express();
const PORT = process.env.PORT || 4000;
const SHEET_NAME = process.env.SHEET_NAME || 'TIRO MX - IMPO (BRAYAN)';
app.use(cors());
app.use(express.json({ limit: '1mb' }));

function ensureEnv() {
  if (!process.env.SPREADSHEET_ID) {
    throw new Error('Falta SPREADSHEET_ID en el entorno.');
  }
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('Falta GOOGLE_APPLICATION_CREDENTIALS (ruta del service account).');
  }
}

function getAuth() {
  ensureEnv();
  return new GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
}

app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/units', async (req, res) => {
  try {
    const date = req.query.date || dayjs().format('YYYY-MM-DD');
    const startDateParam = req.query.startDate;
    const endDateParam = req.query.endDate;
    const debug = req.query.debug === '1';
    const hasRange = Boolean(startDateParam || endDateParam);
    const targetDate = hasRange ? null : dayjs(date);

    let startDate = hasRange ? dayjs(startDateParam || endDateParam || date) : null;
    let endDate = hasRange ? dayjs(endDateParam || startDateParam || date) : null;

    if (!hasRange && (!targetDate || !targetDate.isValid())) {
      return res.status(400).send('Fecha inválida. Usa YYYY-MM-DD.');
    }

    if (hasRange) {
      if (!startDate || !startDate.isValid()) {
        startDate = dayjs();
      }
      if (!endDate || !endDate.isValid()) {
        endDate = startDate;
      }
      const startVal = startDate.startOf('day').valueOf();
      const endVal = endDate.startOf('day').valueOf();
      if (endVal < startVal) {
        [startDate, endDate] = [endDate, startDate];
      }
    }

    const auth = await getAuth();
    const diagnostics = debug ? {} : undefined;
    const units = await fetchUnits({
      auth,
      spreadsheetId: process.env.SPREADSHEET_ID,
      sheetName: SHEET_NAME,
      targetDate,
      dateRange: hasRange ? { startDate, endDate } : null,
      diagnostics
    });

    res.json({
      date,
      startDate: hasRange ? startDate.format('YYYY-MM-DD') : null,
      endDate: hasRange ? endDate.format('YYYY-MM-DD') : null,
      units,
      diagnostics
    });
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message || 'Error al leer Google Sheets.');
  }
});

app.post('/api/render', async (req, res) => {
  try {
    const { date, units, startDate, endDate } = req.body || {};
    const hasRange = Boolean(startDate || endDate);
    const targetDate = hasRange ? null : date ? dayjs(date) : dayjs();
    let rangeStart = hasRange ? dayjs(startDate || endDate || date) : null;
    let rangeEnd = hasRange ? dayjs(endDate || startDate || date) : null;

    if (!hasRange && (!targetDate || !targetDate.isValid())) {
      return res.status(400).send('Fecha inválida. Usa YYYY-MM-DD.');
    }
    if (hasRange) {
      if (!rangeStart || !rangeStart.isValid()) {
        rangeStart = dayjs();
      }
      if (!rangeEnd || !rangeEnd.isValid()) {
        rangeEnd = rangeStart;
      }
      const startVal = rangeStart.startOf('day').valueOf();
      const endVal = rangeEnd.startOf('day').valueOf();
      if (endVal < startVal) {
        [rangeStart, rangeEnd] = [rangeEnd, rangeStart];
      }
    }
    if (!Array.isArray(units) || !units.length) {
      return res.status(400).send('No hay unidades para generar la imagen.');
    }
    const dateLabel = hasRange
      ? `${rangeStart.format('YYYY-MM-DD')} a ${rangeEnd.format('YYYY-MM-DD')}`
      : targetDate.format('YYYY-MM-DD');

    const filenameLabel = hasRange
      ? `${rangeStart.format('YYYY-MM-DD')}_a_${rangeEnd.format('YYYY-MM-DD')}`
      : targetDate.format('YYYY-MM-DD');

    const buffer = await renderImage({ units, dateLabel });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename=SOLICITUD_DIESEL_${filenameLabel}.png`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message || 'Error al generar la imagen.');
  }
});

app.listen(PORT, () => {
  console.log(`DieselMaster server escuchando en http://localhost:${PORT}`);
});
