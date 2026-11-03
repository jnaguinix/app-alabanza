/**
 * Capa de datos. Hoy guarda en localStorage, pero está escrita con la forma de
 * Firestore: todas las funciones son asíncronas, las pantallas piden solo lo que
 * muestran (consultas por rango, páginas, índices) y nunca recorren "todo".
 * Para migrar a Firebase solo hay que reescribir este archivo.
 *
 * Colecciones (equivalentes en Firestore):
 *
 *   servicios/{fecha}      un documento por servicio, con canciones y banda dentro
 *     { id, fecha, director, songs: [{name, artist}], songKeys: [clave],
 *       band: [{instrument, person}], updatedAt: ms, deleted: bool }
 *
 *   indice/canciones       { [clave]: { name, artist, count, dates: [fecha desc] } }
 *   indice/personas        { [clave]: { name, services, roles: { rol: n } } }
 *   indice/meta            { serviceCount }
 *
 * Los índices se actualizan en la misma operación que guarda o borra un servicio
 * (en Firestore: una transacción o una Cloud Function). Con ellos el aviso de
 * repetición, el repertorio, el autocompletado y "Equipo" no leen servicios.
 *
 * Borrar es lógico (`deleted: true`): así otros dispositivos pueden enterarse de
 * un borrado al sincronizar por `updatedAt`.
 */
import { keyOf, normalize } from '../lib/format';
import { buildSeed, INSTRUMENTS } from './seed';

const DOCS_KEY = 'alabanzapp:servicios';
const INDEX_KEY = 'alabanzapp:indice';
const SCHEMA_KEY = 'alabanzapp:schema';
const SCHEMA = 2;
export const DIRECTOR_ROLE = 'Dirige';

const emptyIndex = () => ({ songs: {}, people: {}, serviceCount: 0 });

/* ---------- Almacenamiento ---------- */

const getJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const setJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new Error('No se pudo guardar en este navegador.');
  }
};

/* ---------- Índices ---------- */

const insertDate = (dates, fecha) => (dates.includes(fecha) ? dates : [...dates, fecha].sort().reverse());

/** Suma (sign = 1) o resta (sign = -1) la aportación de un servicio a los índices. */
function applyService(index, doc, sign) {
  index.serviceCount = Math.max(0, index.serviceCount + sign);

  new Map(doc.songs.map((s) => [keyOf(s.name), s])).forEach((song, key) => {
    const entry = index.songs[key] || { name: song.name, artist: song.artist, count: 0, dates: [] };
    entry.count += sign;
    entry.dates = sign > 0 ? insertDate(entry.dates, doc.fecha) : entry.dates.filter((d) => d !== doc.fecha);
    if (entry.count <= 0) delete index.songs[key];
    else index.songs[key] = entry;
  });

  const roles = new Map(); // clave de persona -> { name, roles: [] }
  const add = (name, role) => {
    if (!name) return;
    const key = keyOf(name);
    const cur = roles.get(key) || { name, roles: [] };
    cur.roles.push(role);
    roles.set(key, cur);
  };
  add(doc.director, DIRECTOR_ROLE);
  doc.band.forEach((m) => add(m.person, m.instrument));

  roles.forEach(({ name, roles: list }, key) => {
    const entry = index.people[key] || { name, services: 0, roles: {} };
    entry.services += sign;
    list.forEach((r) => {
      entry.roles[r] = (entry.roles[r] || 0) + sign;
      if (entry.roles[r] <= 0) delete entry.roles[r];
    });
    if (entry.services <= 0) delete index.people[key];
    else index.people[key] = entry;
  });
}

function buildIndex(docs) {
  const index = emptyIndex();
  docs.filter((d) => !d.deleted).forEach((d) => applyService(index, d, 1));
  return index;
}

/** Iguala nombres que solo difieren en tildes, mayúsculas o espacios con los ya existentes. */
function snapToIndex(index, { director, songs, band }) {
  const person = (name) => index.people[keyOf(name)]?.name || name;
  return {
    director: person(director),
    songs: songs.map((s) => ({ ...s, name: index.songs[keyOf(s.name)]?.name || s.name })),
    band: band.map((m) => ({ ...m, person: person(m.person) })),
  };
}

/* ---------- Carga y migración ---------- */

function load() {
  const docs = getJSON(DOCS_KEY, null);
  if (docs === null) {
    const seeded = buildSeed().map(toDoc);
    setJSON(DOCS_KEY, seeded);
    setJSON(INDEX_KEY, buildIndex(seeded));
    setJSON(SCHEMA_KEY, SCHEMA);
    return seeded;
  }
  if (getJSON(SCHEMA_KEY, 1) < SCHEMA) {
    // Datos guardados con la versión anterior: completar campos nuevos y reconstruir índices.
    const migrated = docs.map((d) => toDoc({ ...d, updatedAt: d.updatedAt ?? Date.parse(d.fecha) }));
    setJSON(DOCS_KEY, migrated);
    setJSON(INDEX_KEY, buildIndex(migrated));
    setJSON(SCHEMA_KEY, SCHEMA);
    return migrated;
  }
  return docs;
}

const toDoc = ({ fecha, director, songs, band, updatedAt = Date.now(), deleted = false }) => ({
  id: fecha,
  fecha,
  director,
  songs,
  songKeys: [...new Set(songs.map((s) => keyOf(s.name)))],
  band,
  updatedAt,
  deleted,
});

const live = () => load().filter((d) => !d.deleted);

/* ---------- Servicios ---------- */

/**
 * Consulta de servicios. `after` es el cursor de la página anterior (`next`).
 * Firestore: from/to/director/order/limit son consultas nativas; `text` necesitará un
 * índice de búsqueda aparte (ver pendientes en el README).
 */
export async function queryServices({ from, to, director, text, order = 'desc', limit, after } = {}) {
  const q = normalize(text);
  let list = live().filter(
    (s) =>
      (!from || s.fecha >= from) &&
      (!to || s.fecha <= to) &&
      (!director || s.director === director) &&
      (!q ||
        normalize(s.director).includes(q) ||
        s.songs.some((x) => normalize(x.name).includes(q) || normalize(x.artist).includes(q)) ||
        s.band.some((m) => normalize(m.person).includes(q))),
  );
  list.sort((a, b) => (order === 'asc' ? a.fecha.localeCompare(b.fecha) : b.fecha.localeCompare(a.fecha)));
  if (after) list = list.filter((s) => (order === 'asc' ? s.fecha > after : s.fecha < after));
  if (!limit) return { items: list, next: null };
  const items = list.slice(0, limit);
  return { items, next: list.length > limit ? items[items.length - 1].fecha : null };
}

export async function getService(fecha) {
  const doc = live().find((s) => s.id === fecha);
  return doc || null;
}

/** Varios servicios por fecha (Firestore: lecturas directas en paralelo). */
export async function getServices(fechas) {
  const wanted = new Set(fechas);
  return live()
    .filter((s) => wanted.has(s.fecha))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export async function saveService({ fecha, director, songs, band }) {
  const docs = load();
  const index = getJSON(INDEX_KEY, emptyIndex());
  const old = docs.find((d) => d.id === fecha && !d.deleted);
  if (old) applyService(index, old, -1);

  const doc = toDoc({ fecha, ...snapToIndex(index, { director, songs, band }) });
  applyService(index, doc, 1);

  setJSON(DOCS_KEY, [...docs.filter((d) => d.id !== fecha), doc]);
  setJSON(INDEX_KEY, index);
  return doc;
}

export async function deleteService(fecha) {
  const docs = load();
  const old = docs.find((d) => d.id === fecha && !d.deleted);
  if (!old) return;
  const index = getJSON(INDEX_KEY, emptyIndex());
  applyService(index, old, -1);
  setJSON(DOCS_KEY, docs.map((d) => (d.id === fecha ? { ...d, deleted: true, updatedAt: Date.now() } : d)));
  setJSON(INDEX_KEY, index);
}

/* ---------- Importar y exportar ---------- */

/** Cuántos de los servicios a importar reemplazarían a uno existente (misma fecha). */
export async function previewImport(list) {
  const existing = new Set(live().map((d) => d.id));
  return { total: list.length, replacing: list.filter((s) => existing.has(s.fecha)).length };
}

/**
 * Importa en lote (una sola escritura; en Firestore: writeBatch de hasta 500).
 * Une con lo existente: la misma fecha se reemplaza, el resto se conserva.
 * Los nombres se igualan con los ya conocidos, igual que al guardar a mano.
 */
export async function importServices(list) {
  const byId = new Map(load().map((d) => [d.id, d]));
  const index = getJSON(INDEX_KEY, emptyIndex());
  let replaced = 0;

  [...list]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .forEach((item) => {
      const old = byId.get(item.fecha);
      if (old && !old.deleted) {
        applyService(index, old, -1);
        replaced += 1;
      }
      const doc = toDoc({ fecha: item.fecha, ...snapToIndex(index, item) });
      applyService(index, doc, 1);
      byId.set(doc.id, doc);
    });

  setJSON(DOCS_KEY, [...byId.values()]);
  setJSON(INDEX_KEY, index);
  setJSON(SCHEMA_KEY, SCHEMA);
  return { imported: list.length, replaced };
}

/** Todos los servicios con solo los campos propios (sin índices ni marcas internas). */
export async function exportServices() {
  return live()
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map(({ fecha, director, songs, band }) => ({ fecha, director, songs, band }));
}

/* ---------- Índices (lecturas) ---------- */

/** Un solo documento por índice: canciones, personas y total de servicios. */
export async function getIndex() {
  load();
  const raw = getJSON(INDEX_KEY, emptyIndex());
  const songs = Object.entries(raw.songs)
    .map(([key, s]) => ({ key, ...s, last: s.dates[0] }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const people = Object.entries(raw.people)
    .map(([key, p]) => ({ key, ...p }))
    .sort((a, b) => b.services - a.services || a.name.localeCompare(b.name));
  const instruments = new Set(INSTRUMENTS);
  people.forEach((p) => Object.keys(p.roles).forEach((r) => r !== DIRECTOR_ROLE && instruments.add(r)));
  return {
    songs,
    people,
    instruments: [...instruments].sort((a, b) => a.localeCompare(b)),
    serviceCount: raw.serviceCount,
  };
}

/* ---------- Datos de prueba ---------- */

export async function resetToSample() {
  const docs = buildSeed().map(toDoc);
  setJSON(DOCS_KEY, docs);
  setJSON(INDEX_KEY, buildIndex(docs));
  setJSON(SCHEMA_KEY, SCHEMA);
}

export async function clearAll() {
  setJSON(DOCS_KEY, []);
  setJSON(INDEX_KEY, emptyIndex());
  setJSON(SCHEMA_KEY, SCHEMA);
}
