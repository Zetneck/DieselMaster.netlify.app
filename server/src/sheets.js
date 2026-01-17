const { google } = require('googleapis');
const dayjs = require('dayjs');
require('dayjs/locale/es');
dayjs.locale('es');

const REQUIRED_HEADERS = ['FECHA DE SALIDA', 'TRACTO', 'OPERADOR', 'CIUDAD DESTINO', 'ESTADO'];
const DATE_FORMATS = [
  'YYYY-MM-DD',
  'DD/MM/YYYY',
  'MM/DD/YYYY',
  'DD-MMM-YYYY',
  'DD-MMM-YY'
];

const MONTH_ABBR_ES = {
  ene: '01',
  feb: '02',
  mar: '03',
  abr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  ago: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dic: '12'
};

const normalize = (value) => String(value || '').trim().toUpperCase();

function parseDate(cell) {
  if (cell === undefined || cell === null || cell === '') return null;

  if (!Number.isNaN(Number(cell)) && Number(cell) !== 0) {
    // Google serial date, base 1899-12-30
    return dayjs('1899-12-30').add(Number(cell), 'day');
  }

  const text = String(cell).trim();
  const normalized = text.replace(/\./g, '').trim();
  const lower = normalized.toLowerCase();

  // Handle month abbreviations in Spanish manually (e.g., 17-ene-2026)
  const abbrMatch = lower.match(/^(\d{1,2})[-/](ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[-/](\d{2,4})$/i);
  if (abbrMatch) {
    const dd = abbrMatch[1].padStart(2, '0');
    const mm = MONTH_ABBR_ES[abbrMatch[2].substring(0, 3).toLowerCase()];
    const yyyy = abbrMatch[3].length === 2 ? `20${abbrMatch[3]}` : abbrMatch[3];
    const iso = `${yyyy}-${mm}-${dd}`;
    const parsed = dayjs(iso, 'YYYY-MM-DD', true);
    if (parsed.isValid()) return parsed;
  }

  const candidates = [text, normalized, lower];
  for (const candidate of candidates) {
    for (const fmt of DATE_FORMATS) {
      const parsedLocale = dayjs(candidate, fmt, 'es', true);
      if (parsedLocale.isValid()) return parsedLocale;
      const parsed = dayjs(candidate, fmt, true);
      if (parsed.isValid()) return parsed;
    }
  }

  const loose = dayjs(text);
  return loose.isValid() ? loose : null;
}

async function getValues(auth, spreadsheetId, sheetName) {
  const sheets = google.sheets({ version: 'v4', auth });
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:Z`
  });
  return data.values || [];
}

function findHeaderRow(values) {
  for (let i = 0; i < values.length; i++) {
    const row = values[i] || [];
    const map = {};
    row.forEach((cell, idx) => {
      const key = normalize(cell);
      if (key && map[key] === undefined) {
        map[key] = idx;
      }
    });
    const hasAll = REQUIRED_HEADERS.every((h) => map[h] !== undefined);
    if (hasAll) {
      return { index: i, map };
    }
  }
  return null;
}

function getCell(row, map, header) {
  const value = row[map[header]];
  return value === undefined || value === null ? '' : String(value).trim();
}

async function fetchUnits({ auth, spreadsheetId, sheetName, targetDate, dateRange, diagnostics }) {
  const values = await getValues(auth, spreadsheetId, sheetName);
  const headerInfo = findHeaderRow(values);

  if (!headerInfo) {
    throw new Error('No se encontró un bloque de encabezados con todas las columnas requeridas.');
  }

  const { index, map } = headerInfo;
  const rows = values.slice(index + 1);

  const startValue = dateRange?.startDate
    ? dateRange.startDate.startOf('day').valueOf()
    : targetDate
      ? targetDate.startOf('day').valueOf()
      : null;
  const endValue = dateRange?.endDate
    ? dateRange.endDate.startOf('day').valueOf()
    : targetDate
      ? targetDate.startOf('day').valueOf()
      : null;

  if (diagnostics) {
    diagnostics.totalRows = values.length;
    diagnostics.headerRowIndex = index;
    diagnostics.headerMap = map;
    diagnostics.targetDate = targetDate ? targetDate.format('YYYY-MM-DD') : null;
    diagnostics.dateRange = dateRange
      ? {
          start: dateRange.startDate ? dateRange.startDate.format('YYYY-MM-DD') : null,
          end: dateRange.endDate ? dateRange.endDate.format('YYYY-MM-DD') : null
        }
      : null;
    diagnostics.sheetName = sheetName;
  }

  const filtered = [];
  for (const row of rows) {
    if (!row || row.every((cell) => cell === undefined || cell === null || String(cell).trim() === '')) {
      continue;
    }
    const dateCell = row[map['FECHA DE SALIDA']];
    const parsedDate = parseDate(dateCell);
    if (!parsedDate || !parsedDate.isValid()) continue;

    const currentValue = parsedDate.startOf('day').valueOf();
    if (startValue !== null && currentValue < startValue) continue;
    if (endValue !== null && currentValue > endValue) continue;

    const tracto = getCell(row, map, 'TRACTO');
    const operador = getCell(row, map, 'OPERADOR');
    if (!tracto || !operador) {
      continue; // omitimos filas sin asignación completa
    }

    filtered.push({
      tracto,
      operador,
      ciudadDestino: getCell(row, map, 'CIUDAD DESTINO'),
      estado: getCell(row, map, 'ESTADO')
    });
  }

  if (diagnostics) {
    diagnostics.matchedCount = filtered.length;
  }

  return filtered;
}

module.exports = { fetchUnits };
