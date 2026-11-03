import { toISO } from '../lib/format';

export const INSTRUMENTS = [
  'Corista', 'Piano', 'Guitarra', 'Bajo', 'Batería',
];

const SONGS = [
  ['Océanos', 'Hillsong United'], ['Way Maker', 'Sinach'], ['Reckless Love', 'Cory Asbury'],
  ['Great Are You Lord', 'All Sons & Daughters'], ['Lo Bello de Tu Nombre', 'Hillsong en Español'],
  ['Good Good Father', 'Chris Tomlin'], ['10,000 Reasons', 'Matt Redman'],
  ['Graves Into Gardens', 'Elevation Worship'], ['Goodness of God', 'Bethel Music'],
  ['Tu Fidelidad', 'Marcos Witt'], ['Cuán Grande Es Él', 'Himno'], ['Rey de Reyes', 'Hillsong en Español'],
  ['Digno', 'Miel San Marcos'], ['Gracia Sublime Es', 'Himno'],
];

const DIRECTORS = ['Laura Torres', 'Javier Castillo', 'Kathe', 'Luis'];
const BAND = [
  ['Batería', 'Miguel'], ['Bajo', 'Manuel'], ['Piano', 'Sofía Vargas'],
  ['Guitarra', 'Alejo'], ['Guitarra', 'Jhonny'], ['Corista', 'Hanny'], ['Corista', 'Kathe'],
];

/** Servicios de ejemplo: los últimos 14 domingos, generados de forma determinista. */
export function buildSeed(now = new Date()) {
  const lastSunday = new Date(now);
  lastSunday.setDate(now.getDate() - now.getDay());
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(lastSunday);
    d.setDate(lastSunday.getDate() - i * 7);
    const fecha = toISO(d);
    const songs = [0, 1, 2, 3].map((k) => {
      const [name, artist] = SONGS[(i * 3 + k * 5 + (k > 1 ? 2 : 0)) % SONGS.length];
      return { name, artist };
    });
    const director = DIRECTORS[i % DIRECTORS.length];
    const band = BAND.filter((_, k) => (i + k) % 5 !== 0 || k < 3).map(([instrument, person]) => ({ instrument, person }));
    return { id: fecha, fecha, director, songs, band };
  });
}
