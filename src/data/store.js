/**
 * Capa de datos con Firebase Firestore.
 * Conexión centralizada en tiempo real con soporte sin conexión (IndexedDB),
 * transacciones atómicas para sincronización de índices y control de acceso.
 *
 * Colecciones:
 *   servicios/{fecha}      { id, fecha, director, songs: [{name, artist}], songKeys: [clave],
 *                            band: [{instrument, person}], updatedAt: ms, deleted: bool }
 *   indice/canciones       { songs: { [clave]: { name, artist, count, dates: [fecha desc] } } }
 *   indice/personas        { people: { [clave]: { name, services, roles: { rol: n } } } }
 *   indice/meta            { serviceCount }
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { keyOf, normalize, formatDirectors, cleanSingleName, splitAndCleanNames, normalizeRoleOrInstrument } from '../lib/format';
import { buildSeed, INSTRUMENTS } from './seed';

export const DIRECTOR_ROLE = 'Dirige';

const emptyIndex = () => ({ songs: {}, people: {}, serviceCount: 0 });

const insertDate = (dates, fecha) => (dates.includes(fecha) ? dates : [...dates, fecha].sort().reverse());

/** Suma (sign = 1) o resta (sign = -1) la aportación de un servicio a los índices. */
function applyService(index, docData, sign) {
  index.serviceCount = Math.max(0, (index.serviceCount || 0) + sign);

  if (!index.songs) index.songs = {};
  if (!index.people) index.people = {};

  const uniqueSongs = new Map((docData.songs || []).map((s) => [keyOf(s.name), s]));
  uniqueSongs.forEach((song, key) => {
    const entry = index.songs[key] || { name: song.name, artist: song.artist, count: 0, dates: [] };
    entry.count += sign;
    entry.dates = sign > 0 ? insertDate(entry.dates, docData.fecha) : entry.dates.filter((d) => d !== docData.fecha);
    if (entry.count <= 0) delete index.songs[key];
    else index.songs[key] = entry;
  });

  const roles = new Map();
  const add = (name, role) => {
    if (!name) return;
    const clean = cleanSingleName(name);
    const key = keyOf(clean);
    const cur = roles.get(key) || { name: clean, roles: [] };
    cur.roles.push(role);
    roles.set(key, cur);
  };

  // Contabilizar cada director de forma individual y limpia en el índice
  const directorList = Array.isArray(docData.directors) && docData.directors.length
    ? docData.directors.flatMap((d) => splitAndCleanNames(d))
    : splitAndCleanNames(docData.director || '');
  directorList.forEach((d) => add(d, DIRECTOR_ROLE));

  (docData.band || []).forEach((m) => {
    const normRole = normalizeRoleOrInstrument(m.instrument) || 'Corista';
    splitAndCleanNames(m.person).forEach((p) => add(p, normRole));
  });

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

/** Iguala nombres que solo difieren en tildes, mayúsculas o espacios con los ya existentes. */
function snapToIndex(index, { director, directors, songs, band }) {
  const person = (name) => {
    const clean = cleanSingleName(name);
    return index.people?.[keyOf(clean)]?.name || clean;
  };
  const rawList = Array.isArray(directors) && directors.length
    ? directors.flatMap((d) => splitAndCleanNames(d))
    : splitAndCleanNames(director || '');
  const snappedDirectors = rawList.map((d) => person(d.trim())).filter(Boolean);
  const finalDirector = formatDirectors(snappedDirectors) || person(director || '');

  return {
    director: finalDirector,
    directors: snappedDirectors,
    songs: (songs || []).map((s) => ({ ...s, name: index.songs?.[keyOf(s.name)]?.name || s.name })),
    band: (band || []).flatMap((m) => {
      const split = splitAndCleanNames(m.person);
      const list = split.length ? split : [m.person];
      return list.map((p) => ({ ...m, person: person(p) }));
    }),
  };
}

const toDoc = ({ fecha, director, directors, songs = [], band = [], updatedAt = Date.now(), deleted = false }) => {
  const dList = Array.isArray(directors) && directors.length
    ? directors
    : director ? [director] : [];
  const finalDirector = director || formatDirectors(dList);

  return {
    id: fecha,
    fecha,
    director: finalDirector,
    directors: dList,
    songs,
    songKeys: [...new Set(songs.map((s) => keyOf(s.name)))],
    band,
    updatedAt,
    deleted,
  };
};

/* ---------- Caché en Memoria y Deduplicación de Consultas ---------- */

let servicesCache = null;
let servicesCachePromise = null;
let servicesCacheTimestamp = 0;
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutos de vigencia automática o hasta la siguiente mutación

export function invalidateServicesCache() {
  servicesCache = null;
  servicesCachePromise = null;
  servicesCacheTimestamp = 0;
}

/**
 * Obtiene todos los servicios activos desde la caché en memoria o desde Firestore.
 * Deduplica consultas concurrentes en una sola llamada de red.
 */
export async function fetchAllActiveServices(force = false) {
  const now = Date.now();
  if (!force && servicesCache && now - servicesCacheTimestamp < CACHE_TTL_MS) {
    return servicesCache;
  }
  if (!force && servicesCachePromise) {
    return servicesCachePromise;
  }

  servicesCachePromise = (async () => {
    try {
      const qCol = collection(db, 'servicios');
      let snapshot;
      try {
        const q = query(qCol, where('deleted', '==', false), orderBy('fecha', 'desc'));
        snapshot = await getDocs(q);
      } catch {
        snapshot = await getDocs(qCol);
      }

      servicesCache = snapshot.docs
        .map((d) => d.data())
        .filter((s) => !s.deleted);
      servicesCacheTimestamp = Date.now();
      return servicesCache;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'servicios');
      return servicesCache || [];
    } finally {
      servicesCachePromise = null;
    }
  })();

  return servicesCachePromise;
}

/* ---------- Servicios (Consultas y Lecturas Optimizadas) ---------- */

export async function queryServices({ from, to, director, text, order = 'desc', limit: queryLimit, after } = {}) {
  try {
    const all = await fetchAllActiveServices();
    let list = [...all];

    const qText = normalize(text);
    if (from) list = list.filter((s) => s.fecha >= from);
    if (director) {
      const qDir = normalize(director);
      list = list.filter((s) => {
        if (Array.isArray(s.directors) && s.directors.length) {
          return s.directors.some((d) => normalize(d) === qDir);
        }
        const splitted = (s.director || '')
          .split(/\s*(?:\/|,|&|\by\b)\s*/i)
          .map((d) => normalize(d.trim()))
          .filter(Boolean);
        return splitted.includes(qDir) || normalize(s.director) === qDir;
      });
    }
    if (qText) {
      list = list.filter(
        (s) =>
          normalize(s.director).includes(qText) ||
          (s.songs || []).some((x) => normalize(x.name).includes(qText) || normalize(x.artist).includes(qText)) ||
          (s.band || []).some((m) => normalize(m.person).includes(qText)),
      );
    }

    list.sort((a, b) => (order === 'asc' ? a.fecha.localeCompare(b.fecha) : b.fecha.localeCompare(a.fecha)));

    if (after) {
      list = list.filter((s) => (order === 'asc' ? s.fecha > after : s.fecha < after));
    }

    if (!queryLimit) return { items: list, next: null };
    const items = list.slice(0, queryLimit);
    return { items, next: list.length > queryLimit ? items[items.length - 1].fecha : null };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'servicios');
    return { items: [], next: null };
  }
}

export async function getService(fecha) {
  if (!fecha) return null;
  // 1. Intentar resolver de inmediato desde la caché en memoria (0 lecturas a Firestore)
  if (servicesCache) {
    const cached = servicesCache.find((s) => s.fecha === fecha);
    if (cached) return cached;
  }

  try {
    const snap = await getDoc(doc(db, 'servicios', fecha));
    if (!snap.exists()) return null;
    const data = snap.data();
    return data.deleted ? null : data;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `servicios/${fecha}`);
    return null;
  }
}

export async function getServices(fechas) {
  if (!fechas || !fechas.length) return [];
  // 1. Resolver desde la lista en memoria si está disponible (0 lecturas a Firestore)
  const all = await fetchAllActiveServices();
  const dateSet = new Set(fechas);
  const matched = all.filter((s) => dateSet.has(s.fecha));
  if (matched.length === fechas.length) {
    return matched.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  // Fallback seguro si alguna fecha no estuviera en caché
  try {
    const snaps = await Promise.all(fechas.map((f) => getDoc(doc(db, 'servicios', f))));
    return snaps
      .filter((s) => s.exists() && !s.data().deleted)
      .map((s) => s.data())
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'servicios');
    return matched.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }
}

export async function saveService({ fecha, director, directors, songs, band }) {
  try {
    const serviceRef = doc(db, 'servicios', fecha);
    const cancionesRef = doc(db, 'indice', 'canciones');
    const personasRef = doc(db, 'indice', 'personas');
    const metaRef = doc(db, 'indice', 'meta');

    let savedDoc = null;

    await runTransaction(db, async (transaction) => {
      const [serviceSnap, cancionesSnap, personasSnap, metaSnap] = await Promise.all([
        transaction.get(serviceRef),
        transaction.get(cancionesRef),
        transaction.get(personasRef),
        transaction.get(metaRef),
      ]);

      const index = {
        songs: cancionesSnap.exists() ? { ...(cancionesSnap.data()?.songs || {}) } : {},
        people: personasSnap.exists() ? { ...(personasSnap.data()?.people || {}) } : {},
        serviceCount: metaSnap.exists() ? metaSnap.data()?.serviceCount || 0 : 0,
      };

      const oldDoc = serviceSnap.exists() ? serviceSnap.data() : null;
      if (oldDoc && !oldDoc.deleted) {
        applyService(index, oldDoc, -1);
      }

      const snapped = snapToIndex(index, { director, directors, songs, band });
      const newDoc = toDoc({ fecha, ...snapped, updatedAt: Date.now(), deleted: false });
      applyService(index, newDoc, 1);

      transaction.set(serviceRef, newDoc);
      transaction.set(cancionesRef, { songs: index.songs });
      transaction.set(personasRef, { people: index.people });
      transaction.set(metaRef, { serviceCount: index.serviceCount });

      savedDoc = newDoc;
    });

    invalidateServicesCache();
    return savedDoc;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `servicios/${fecha}`);
  }
}

export async function deleteService(fecha) {
  try {
    const serviceRef = doc(db, 'servicios', fecha);
    const cancionesRef = doc(db, 'indice', 'canciones');
    const personasRef = doc(db, 'indice', 'personas');
    const metaRef = doc(db, 'indice', 'meta');

    await runTransaction(db, async (transaction) => {
      const [serviceSnap, cancionesSnap, personasSnap, metaSnap] = await Promise.all([
        transaction.get(serviceRef),
        transaction.get(cancionesRef),
        transaction.get(personasRef),
        transaction.get(metaRef),
      ]);

      if (!serviceSnap.exists()) return;
      const oldDoc = serviceSnap.data();
      if (oldDoc.deleted) return;

      const index = {
        songs: cancionesSnap.exists() ? { ...(cancionesSnap.data()?.songs || {}) } : {},
        people: personasSnap.exists() ? { ...(personasSnap.data()?.people || {}) } : {},
        serviceCount: metaSnap.exists() ? metaSnap.data()?.serviceCount || 0 : 0,
      };

      applyService(index, oldDoc, -1);

      transaction.update(serviceRef, { deleted: true, updatedAt: Date.now() });
      transaction.set(cancionesRef, { songs: index.songs });
      transaction.set(personasRef, { people: index.people });
      transaction.set(metaRef, { serviceCount: index.serviceCount });
    });
    invalidateServicesCache();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `servicios/${fecha}`);
  }
}

/* ---------- Importar y Exportar ---------- */

export async function previewImport(list) {
  try {
    const snapshot = await getDocs(collection(db, 'servicios'));
    const existing = new Set(
      snapshot.docs
        .map((d) => d.data())
        .filter((d) => !d.deleted)
        .map((d) => d.id),
    );
    return { total: list.length, replacing: list.filter((s) => existing.has(s.fecha)).length };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'servicios');
    return { total: list.length, replacing: 0 };
  }
}

export async function importServices(list) {
  try {
    const snapshot = await getDocs(collection(db, 'servicios'));
    const byId = new Map(snapshot.docs.map((d) => [d.id, d.data()]));

    const [cancionesSnap, personasSnap, metaSnap] = await Promise.all([
      getDoc(doc(db, 'indice', 'canciones')),
      getDoc(doc(db, 'indice', 'personas')),
      getDoc(doc(db, 'indice', 'meta')),
    ]);

    const index = {
      songs: cancionesSnap.exists() ? { ...(cancionesSnap.data()?.songs || {}) } : {},
      people: personasSnap.exists() ? { ...(personasSnap.data()?.people || {}) } : {},
      serviceCount: metaSnap.exists() ? metaSnap.data()?.serviceCount || 0 : 0,
    };

    let replaced = 0;
    const sortedList = [...list].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const docsToSave = [];

    for (const item of sortedList) {
      const old = byId.get(item.fecha);
      if (old && !old.deleted) {
        applyService(index, old, -1);
        replaced += 1;
      }
      const docData = toDoc({ fecha: item.fecha, ...snapToIndex(index, item), updatedAt: Date.now(), deleted: false });
      applyService(index, docData, 1);
      byId.set(docData.id, docData);
      docsToSave.push(docData);
    }

    const BATCH_SIZE = 450;
    for (let i = 0; i < docsToSave.length; i += BATCH_SIZE) {
      const chunk = docsToSave.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      for (const d of chunk) {
        batch.set(doc(db, 'servicios', d.id), d);
      }
      if (i + BATCH_SIZE >= docsToSave.length) {
        batch.set(doc(db, 'indice', 'canciones'), { songs: index.songs });
        batch.set(doc(db, 'indice', 'personas'), { people: index.people });
        batch.set(doc(db, 'indice', 'meta'), { serviceCount: index.serviceCount });
      }
      await batch.commit();
    }

    if (docsToSave.length === 0) {
      const batch = writeBatch(db);
      batch.set(doc(db, 'indice', 'canciones'), { songs: index.songs });
      batch.set(doc(db, 'indice', 'personas'), { people: index.people });
      batch.set(doc(db, 'indice', 'meta'), { serviceCount: index.serviceCount });
      await batch.commit();
    }

    invalidateServicesCache();
    return { imported: list.length, replaced };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'servicios');
  }
}

export async function exportServices() {
  try {
    const list = await fetchAllActiveServices();
    return list
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map(({ fecha, director, songs, band }) => ({ fecha, director, songs, band }));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'servicios');
    return [];
  }
}

/* ---------- Índices (Lecturas) ---------- */

export async function getIndex() {
  try {
    const [cancionesSnap, personasSnap, metaSnap] = await Promise.all([
      getDoc(doc(db, 'indice', 'canciones')),
      getDoc(doc(db, 'indice', 'personas')),
      getDoc(doc(db, 'indice', 'meta')),
    ]);

    const cancionesData = cancionesSnap.exists() ? cancionesSnap.data() : { songs: {} };
    const personasData = personasSnap.exists() ? personasSnap.data() : { people: {} };
    const metaData = metaSnap.exists() ? metaSnap.data() : { serviceCount: 0 };

    const songs = Object.entries(cancionesData.songs || {})
      .map(([key, s]) => ({ key, ...s, last: s.dates?.[0] || null }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const people = Object.entries(personasData.people || {})
      .map(([key, p]) => ({ key, ...p }))
      .sort((a, b) => (b.services || 0) - (a.services || 0) || a.name.localeCompare(b.name));

    const instruments = new Set(INSTRUMENTS);
    people.forEach((p) =>
      Object.keys(p.roles || {}).forEach((r) => {
        if (r !== DIRECTOR_ROLE) {
          const norm = normalizeRoleOrInstrument(r);
          if (norm) instruments.add(norm);
        }
      })
    );

    return {
      songs,
      people,
      instruments: [...instruments].sort((a, b) => a.localeCompare(b)),
      serviceCount: metaData.serviceCount || 0,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'indice');
    return { songs: [], people: [], instruments: [...INSTRUMENTS], serviceCount: 0 };
  }
}

/* ---------- Datos de Prueba / Limpieza ---------- */

export async function resetToSample() {
  const seeded = buildSeed().map(toDoc);
  return importServices(seeded);
}

export async function clearAll() {
  try {
    const snapshot = await getDocs(collection(db, 'servicios'));
    const BATCH_SIZE = 450;
    const docsList = snapshot.docs;
    for (let i = 0; i < docsList.length; i += BATCH_SIZE) {
      const chunk = docsList.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      for (const d of chunk) {
        batch.delete(d.ref);
      }
      if (i + BATCH_SIZE >= docsList.length) {
        batch.set(doc(db, 'indice', 'canciones'), { songs: {} });
        batch.set(doc(db, 'indice', 'personas'), { people: {} });
        batch.set(doc(db, 'indice', 'meta'), { serviceCount: 0 });
      }
      await batch.commit();
    }

    if (docsList.length === 0) {
      const batch = writeBatch(db);
      batch.set(doc(db, 'indice', 'canciones'), { songs: {} });
      batch.set(doc(db, 'indice', 'personas'), { people: {} });
      batch.set(doc(db, 'indice', 'meta'), { serviceCount: 0 });
      await batch.commit();
    }
    invalidateServicesCache();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'servicios');
  }
}
