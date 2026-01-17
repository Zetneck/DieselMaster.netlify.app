import React, { useEffect, useRef, useState } from 'react';
import { fetchUnits, generateImage } from './api';

const emptyRow = { tracto: '', operador: '', ciudadDestino: '', estado: '' };

const today = () => new Date().toISOString().slice(0, 10);
const sanitizeDate = (value, fallback) => (value && value.length ? value : fallback || today());

export default function App() {
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [lastSync, setLastSync] = useState('');
  const loadRef = useRef(0);

  const loadUnits = async (targetStart = startDate, targetEnd = endDate) => {
    const safeStart = sanitizeDate(targetStart, startDate);
    const safeEnd = sanitizeDate(targetEnd, safeStart);
    const normalizedEnd = safeEnd < safeStart ? safeStart : safeEnd;
    const stamp = ++loadRef.current;
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const data = await fetchUnits({ startDate: safeStart, endDate: normalizedEnd, date: safeStart });
      if (stamp !== loadRef.current) return; // ignora respuestas antiguas
      setRows(data);
      setLastSync(new Date().toLocaleTimeString());
      if (!data.length) setInfo('Sin unidades para la fecha seleccionada.');
    } catch (err) {
      setError(err.message || 'Error al cargar unidades.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUnits(startDate, endDate);
  }, [startDate, endDate]);

  const updateRow = (index, field, value) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const deleteRow = (index) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const addRow = () => setRows((prev) => [...prev, { ...emptyRow }]);

  const summary = {
    unidades: rows.length,
    tractos: new Set(rows.map((r) => (r.tracto || '').trim()).filter(Boolean)).size,
    operadores: new Set(rows.map((r) => (r.operador || '').trim()).filter(Boolean)).size,
    destinos: new Set(rows.map((r) => (r.ciudadDestino || '').trim()).filter(Boolean)).size
  };

  const syncLabel = loading
    ? 'Sincronizando…'
    : lastSync
      ? `Sincronizado a las ${lastSync}`
      : 'Aún sin sincronizar';

  const rangeLabel = startDate === endDate ? startDate : `${startDate} a ${endDate}`;

  const downloadImage = async () => {
    setError('');
    setInfo('');
    if (!rows.length) {
      setError('Agrega al menos una unidad antes de generar la imagen.');
      return;
    }
    setDownloading(true);
    try {
      const safeStart = sanitizeDate(startDate);
      const safeEnd = sanitizeDate(endDate, safeStart);
      const normalizedEnd = safeEnd < safeStart ? safeStart : safeEnd;
      const blob = await generateImage(rows, { date: safeStart, startDate: safeStart, endDate: normalizedEnd });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SOLICITUD_DIESEL_${safeStart}${normalizedEnd !== safeStart ? `_a_${normalizedEnd}` : ''}.png`;
      link.click();
      URL.revokeObjectURL(url);
      setInfo('Imagen generada y descargada.');
    } catch (err) {
      setError(err.message || 'Error al generar la imagen.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="page">
      <header className="hero panel">
        <div className="hero-text">
          <div className="eyebrow-row">
            <span className="pill accent">Operación activa</span>
            <span className="pill ghost">Auto-sync al cambiar fechas</span>
            <span className="pill ghost">{syncLabel}</span>
          </div>
          <h1>Solicitud de diésel</h1>
          <p className="subtitle">Carga automática, edición inmediata y exportación lista para enviar.</p>
          <div className="meta">
            <span className="pill">Rango: {rangeLabel}</span>
            <span className="pill ghost">Unidades: {summary.unidades}</span>
            <span className="pill ghost">Tractos: {summary.tractos}</span>
            <span className="pill ghost">Operadores: {summary.operadores}</span>
            <span className="pill ghost">Destinos: {summary.destinos}</span>
          </div>
        </div>
        <div className="date-card panel">
          <div className="date-picker">
            <label>Rango de fechas</label>
            <div className="date-row">
              <div className="date-field">
                <span className="micro">Inicio</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const next = sanitizeDate(e.target.value, startDate);
                    setStartDate(next);
                    if (next > endDate) setEndDate(next);
                  }}
                />
              </div>
              <div className="date-field">
                <span className="micro">Fin</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    const next = sanitizeDate(e.target.value, startDate);
                    setEndDate(next < startDate ? startDate : next);
                  }}
                />
              </div>
            </div>
            <p className="micro muted">Se actualiza en automático al elegir fechas.</p>
          </div>
          <div className="date-actions">
            <button className="ghost" onClick={() => loadUnits(startDate, endDate)} disabled={loading}>
              {loading ? 'Cargando…' : 'Recargar ahora'}
            </button>
            <button className="primary" onClick={downloadImage} disabled={downloading || !rows.length}>
              {downloading ? 'Generando…' : 'Exportar Programación'}
            </button>
          </div>
        </div>
      </header>

      <section className="stat-grid">
        <div className="stat-card">
          <p className="label">Unidades listas</p>
          <h3>{summary.unidades}</h3>
          <span className="micro">Filtradas con tracto y operador</span>
        </div>
        <div className="stat-card">
          <p className="label">Tractos únicos</p>
          <h3>{summary.tractos}</h3>
          <span className="micro">Asignaciones sin duplicados</span>
        </div>
        <div className="stat-card">
          <p className="label">Operadores</p>
          <h3>{summary.operadores}</h3>
          <span className="micro">Conductores asignados</span>
        </div>
        <div className="stat-card">
          <p className="label">Destinos</p>
          <h3>{summary.destinos}</h3>
          <span className="micro">Cobertura de entrega</span>
        </div>
      </section>

      <section className="card panel">
        <div className="card-header">
          <div>
            <h2>Unidades programadas</h2>
            <p>Edición inline, agrega o elimina filas antes de generar la solicitud.</p>
          </div>
          <div className="actions">
            <button className="ghost" onClick={addRow}>Agregar fila</button>
          </div>
        </div>

        {error && <div className="alert error">{error}</div>}
        {info && !loading && <div className="alert info">{info}</div>}

        <div className={`table-wrap ${loading ? 'loading' : ''}`}>
          {loading && <div className="shimmer" aria-label="Cargando" />}
          <table>
            <thead>
              <tr>
                <th>TRACTO</th>
                <th>OPERADOR</th>
                <th>CIUDAD DESTINO</th>
                <th>ESTADO</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <td>
                    <input
                      value={row.tracto || ''}
                      onChange={(e) => updateRow(index, 'tracto', e.target.value)}
                      placeholder="Tracto"
                    />
                  </td>
                  <td>
                    <input
                      value={row.operador || ''}
                      onChange={(e) => updateRow(index, 'operador', e.target.value)}
                      placeholder="Operador"
                    />
                  </td>
                  <td>
                    <input
                      value={row.ciudadDestino || ''}
                      onChange={(e) => updateRow(index, 'ciudadDestino', e.target.value)}
                      placeholder="Ciudad destino"
                    />
                  </td>
                  <td>
                    <input
                      value={row.estado || ''}
                      onChange={(e) => updateRow(index, 'estado', e.target.value)}
                      placeholder="Estado"
                    />
                  </td>
                  <td className="actions">
                    <button className="ghost danger" onClick={() => deleteRow(index)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan="5" className="empty">Sin unidades cargadas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
