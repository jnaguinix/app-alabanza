/**
 * Lee y valida un archivo JSON de servicios. No toca el almacenamiento: solo
 * devuelve servicios limpios y la lista de entradas descartadas.
 *
 * Formatos aceptados:
 *   [ { fecha, director, songs, band }, ... ]          lista directa (consulta de Supabase)
 *   { "servicios": [ ... ] }                           exportación de la app
 *   [ { "servicios": [ ... ] } ]                       una fila copiada del editor SQL
 * `songs` y `band` pueden venir como texto JSON (así salen en un CSV).
 */
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const text = (v) => (v == null ? '' : String(v)).trim();

function validDate(fecha) {
  if (!ISO.test(fecha)) return false;
  const d = new Date(`${fecha}T00:00:00`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha;
}

function unwrap(json) {
  if (Array.isArray(json)) {
    const only = json.length === 1 ? json[0] : null;
    if (only && !Array.isArray(only) && (only.servicios || only.services)) return only.servicios || only.services;
    return json;
  }
  if (json && typeof json === 'object') return json.servicios || json.services || null;
  return null;
}

const asList = (value) => {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value == null ? [] : Array.isArray(value) ? value : null;
};

/** @returns {{ services: Array, skipped: Array<{ position: number, reason: string }> }} */
export function parseServices(json) {
  const list = unwrap(json);
  if (!Array.isArray(list)) throw new Error('El archivo no contiene una lista de servicios.');

  const byDate = new Map(); // si una fecha se repite, gana la última
  const skipped = [];

  list.forEach((raw, i) => {
    const position = i + 1;
    if (!raw || typeof raw !== 'object') return skipped.push({ position, reason: 'No es un servicio.' });

    const fecha = text(raw.fecha).slice(0, 10);
    if (!validDate(fecha)) return skipped.push({ position, reason: `Fecha no válida: "${text(raw.fecha)}".` });

    const songsRaw = asList(raw.songs);
    const bandRaw = asList(raw.band);
    if (!songsRaw || !bandRaw) return skipped.push({ position, reason: `Canciones o músicos mal formados (${fecha}).` });

    byDate.set(fecha, {
      fecha,
      director: text(raw.director),
      songs: songsRaw
        .map((s) => ({ name: text(s?.name), artist: text(s?.artist) || 'Desconocido' }))
        .filter((s) => s.name),
      band: bandRaw
        .map((m) => ({ instrument: text(m?.instrument), person: text(m?.person) }))
        .filter((m) => m.instrument && m.person),
    });
  });

  return { services: [...byDate.values()], skipped };
}
