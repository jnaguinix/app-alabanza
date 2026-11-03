const parse = (iso) => new Date(`${iso}T00:00:00`);

export const toISO = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const todayISO = () => toISO(new Date());

export const dayParts = (iso) => {
  const d = parse(iso);
  return {
    weekday: d.toLocaleDateString('es', { weekday: 'short' }).replace('.', ''),
    day: d.getDate(),
    month: d.toLocaleDateString('es', { month: 'short' }).replace('.', ''),
  };
};

/** Días enteros de `from` a `to` (fechas ISO). */
export const daysBetween = (from, to) => Math.round((parse(to) - parse(from)) / 86400000);

/** "hace 2 semanas", "hace 3 meses"… medido hasta `ref` (hoy por defecto). */
export const ago = (iso, ref = todayISO()) => {
  const days = daysBetween(iso, ref);
  if (days <= 0) return 'hoy';
  if (days < 7) return days === 1 ? 'ayer' : `hace ${days} días`;
  if (days < 60) {
    const w = Math.round(days / 7);
    return w === 1 ? 'hace 1 semana' : `hace ${w} semanas`;
  }
  const m = Math.round(days / 30);
  return m < 12 ? `hace ${m} meses` : m < 18 ? 'hace 1 año' : `hace ${Math.round(m / 12)} años`;
};

/** El próximo domingo a partir de hoy (hoy mismo si es domingo). */
export const nextSundayISO = () => {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return toISO(d);
};

export const longDate = (iso) =>
  parse(iso).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const monthLabel = (iso) => {
  const s = parse(iso).toLocaleDateString('es', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const monthKey = (iso) => iso.slice(0, 7);

export const normalize = (s = '') =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export const countBy = (items) => {
  const map = new Map();
  items.forEach((i) => map.set(i, (map.get(i) || 0) + 1));
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};

/** Clave estable de un nombre: sin tildes, mayúsculas ni signos ("Océanos " -> "oceanos"). */
export const keyOf = (s = '') => normalize(s).replace(/[^a-z0-9]+/g, '') || normalize(s);

/** Formatea una lista de directores con conjunción natural en español: ['Camilo', 'Kathe'] -> "Camilo y Kathe" */
export const formatDirectors = (directors = []) => {
  const cleanList = (Array.isArray(directors) ? directors : [directors])
    .map((d) => (typeof d === 'string' ? d.trim() : ''))
    .filter(Boolean);
  if (!cleanList.length) return '';
  if (cleanList.length === 1) return cleanList[0];
  if (cleanList.length === 2) return `${cleanList[0]} y ${cleanList[1]}`;
  const allExceptLast = cleanList.slice(0, -1).join(', ');
  const last = cleanList[cleanList.length - 1];
  return `${allExceptLast} y ${last}`;
};

/**
 * Normaliza un nombre individual corrigiendo errores tipográficos comunes
 * (ej. "Luchó" con tilde -> "Lucho"), eliminando espacios dobles y capitalizando.
 */
export const cleanSingleName = (rawName = '') => {
  let name = (rawName || '').trim();
  if (!name) return '';

  const lower = name.toLowerCase();
  if (lower === 'luchó' || lower === 'lucho') {
    return 'Lucho';
  }

  name = name.replace(/\s+/g, ' ');

  if (name === lower) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }

  return name;
};

/**
 * Detecta y separa cadenas compuestas (con '/', 'y', '&', ',')
 * en una lista de nombres individuales limpios y únicos.
 */
export const splitAndCleanNames = (raw = '') => {
  if (!raw) return [];

  const rawStr = String(raw).trim();
  if (!rawStr) return [];

  const parts = rawStr
    .split(/\s*(?:\/|,|&|\by\b)\s*/i)
    .map((p) => cleanSingleName(p))
    .filter((p) => Boolean(p) && p.length > 1);

  return [...new Set(parts)];
};

/**
 * Determina si una cadena es un nombre compuesto que debe ser descompuesto.
 */
export const isCompoundName = (raw = '') => {
  const parts = splitAndCleanNames(raw);
  return parts.length > 1;
};

