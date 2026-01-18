const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const API_KEY = import.meta.env.VITE_API_KEY || '';

const authHeaders = API_KEY ? { 'x-api-key': API_KEY } : {};

async function handleResponse(response) {
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401) {
      throw new Error(text || 'No autorizado: configura VITE_API_KEY o elimina API_KEY en el backend.');
    }
    throw new Error(text || `Error del servidor (HTTP ${response.status})`);
  }
  return response;
}

export async function fetchUnits({ date, startDate, endDate }) {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  if (!startDate && !endDate && date) params.set('date', date);
  const response = await handleResponse(
    await fetch(`${API_BASE}/api/units?${params.toString() || `date=${encodeURIComponent(date)}`}`, {
      headers: { ...authHeaders }
    })
  );
  const payload = await response.json();
  return payload.units || [];
}

export async function generateImage(units, { date, startDate, endDate }) {
  const response = await handleResponse(
    await fetch(`${API_BASE}/api/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ date, startDate, endDate, units })
    })
  );
  return response.blob();
}
