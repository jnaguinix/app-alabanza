import { useMemo, useState } from 'react';
import { BarChart3, Search, SearchX } from 'lucide-react';
import { useApp } from '../app-context';
import { Chip, Empty, PageHeader, ScrollableBar, Sheet, Skeleton, cx, inputClass } from '../components/ui';
import { DateBlock } from '../components/ServiceCard';
import { DIRECTOR_ROLE, getServices, queryServices } from '../data/store';
import { useAsync } from '../hooks/useAsync';
import { ago, countBy, daysBetween, longDate, normalize, plural, todayISO, toISO } from '../lib/format';

const VIEWS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'repertorio', label: 'Repertorio' },
  { id: 'equipo', label: 'Equipo' },
];

const RANGES = [
  { id: 'all', label: 'Todo' },
  { id: 'year', label: 'Este año' },
  { id: '90', label: 'Últimos 90 días' },
  { id: '30', label: 'Últimos 30 días' },
];

const SORTS = [
  { id: 'count', label: 'Más cantadas' },
  { id: 'oldest', label: 'Hace más tiempo' },
  { id: 'az', label: 'A–Z' },
];

const FORGOTTEN_DAYS = 90;

function rangeStart(id) {
  const now = new Date();
  if (id === 'year') return `${now.getFullYear()}-01-01`;
  if (id === '90' || id === '30') {
    const d = new Date(now);
    d.setDate(d.getDate() - Number(id));
    return toISO(d);
  }
  return '';
}

function Kpi({ value, label, wide }) {
  return (
    <div className={`rounded-xl border border-line bg-surface p-3 ${wide ? 'col-span-2 sm:col-span-1' : ''}`}>
      <p className="truncate font-display text-2xl font-extrabold">{value}</p>
      <p className="mt-0.5 text-sm text-muted">{label}</p>
    </div>
  );
}

function Bar({ value, max, color }) {
  return (
    <span className="mt-1.5 block h-2 rounded-full bg-sunken group-hover:bg-line">
      <span
        className={`block h-2 origin-left rounded-full ${color} [animation:grow-x_.5s_ease-out]`}
        style={{ width: `${(value / (max || 1)) * 100}%` }}
      />
    </span>
  );
}

function BarList({ title, rows, unit, onPick, empty, color }) {
  const max = rows[0]?.[1];
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-2 font-display text-lg font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-muted">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {rows.map(([label, count]) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => onPick(label)}
                className="group block min-h-10 w-full rounded-lg px-2 py-1 text-left hover:bg-sunken"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-medium">{label}</span>
                  <span className="shrink-0 text-sm tabular-nums text-muted">{plural(count, unit[0], unit[1])}</span>
                </span>
                <Bar value={count} max={max} color={color} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ChipRow({ label, children }) {
  return (
    <ScrollableBar containerClassName="-mx-4 px-4 md:mx-0 md:px-0" label={label}>
      {children}
    </ScrollableBar>
  );
}

/* ---------- Resumen ---------- */

function Summary({ filtered, onPick }) {
  const stats = useMemo(() => {
    const songs = countBy(filtered.flatMap((s) => s.songs.map((x) => x.name)));
    return {
      songs,
      artists: countBy(filtered.flatMap((s) => [...new Set(s.songs.map((x) => x.artist))])),
      directors: countBy(filtered.map((s) => s.director).filter(Boolean)),
    };
  }, [filtered]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <Kpi value={filtered.length} label="Servicios" />
        <Kpi value={stats.songs.length} label="Canciones distintas" />
        <Kpi value={stats.songs[0]?.[0] ?? '—'} label={stats.songs[0] ? `Más cantada (${stats.songs[0][1]} veces)` : 'Más cantada'} wide />
      </div>
      <BarList title="Canciones más cantadas" rows={stats.songs.slice(0, 8)} unit={['vez', 'veces']} color="bg-brand-blue" empty="Sin canciones." onPick={(v) => onPick({ kind: 'song', value: v })} />
      <BarList title="Artistas más cantados" rows={stats.artists.slice(0, 6)} unit={['servicio', 'servicios']} color="bg-brand-red" empty="Sin artistas." onPick={(v) => onPick({ kind: 'artist', value: v })} />
      <BarList title="Quién dirige más" rows={stats.directors.slice(0, 6)} unit={['servicio', 'servicios']} color="bg-brand-yellow" empty="Sin directores." onPick={(v) => onPick({ kind: 'director', value: v })} />
    </div>
  );
}

/* ---------- Repertorio ---------- */

function Repertoire({ onPick }) {
  const { index } = useApp();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('count');
  const [forgotten, setForgotten] = useState(false);
  const today = todayISO();

  // El índice ya trae cada canción con su conteo y la fecha de la última vez.
  const songs = useMemo(() => index.songs.filter((x) => x.last <= today), [index, today]);

  const forgottenCount = songs.filter((x) => daysBetween(x.last, today) > FORGOTTEN_DAYS).length;

  const rows = useMemo(() => {
    const q = normalize(query);
    const list = songs.filter(
      (x) =>
        (!q || normalize(x.name).includes(q) || normalize(x.artist).includes(q)) &&
        (!forgotten || daysBetween(x.last, today) > FORGOTTEN_DAYS),
    );
    const by = {
      count: (a, b) => b.count - a.count || a.name.localeCompare(b.name),
      oldest: (a, b) => a.last.localeCompare(b.last),
      az: (a, b) => a.name.localeCompare(b.name),
    }[sort];
    return list.sort(by);
  }, [songs, query, sort, forgotten, today]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={18} aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca una canción o artista"
          aria-label="Buscar en el repertorio"
          className={`${inputClass} pl-10`}
        />
      </div>
      <ChipRow label="Orden">
        <Chip active={forgotten} onClick={() => setForgotten(!forgotten)}>
          Sin cantar hace +3 meses ({forgottenCount})
        </Chip>
        {SORTS.map((s) => (
          <Chip key={s.id} active={sort === s.id} onClick={() => setSort(s.id)}>{s.label}</Chip>
        ))}
      </ChipRow>

      {rows.length === 0 ? (
        <Empty icon={SearchX} title={forgotten ? 'Ninguna canción olvidada' : 'Ninguna canción coincide'}>
          {forgotten ? `Todas se han cantado en los últimos ${FORGOTTEN_DAYS} días.` : 'Prueba con otro nombre.'}
        </Empty>
      ) : (
        <section className="rounded-2xl border border-line bg-surface">
          <p className="border-b border-line px-4 py-2.5 text-sm text-muted">{plural(rows.length, 'canción', 'canciones')}</p>
          <ul className="divide-y divide-line">
            {rows.map((x) => {
              const old = daysBetween(x.last, today) > FORGOTTEN_DAYS;
              return (
                <li key={x.name}>
                  <button
                    type="button"
                    onClick={() => onPick({ kind: 'song', value: x.name, dates: x.dates })}
                    className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-sunken"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{x.name}</p>
                      <p className="truncate text-sm text-muted">{x.artist}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums">{plural(x.count, 'vez', 'veces')}</p>
                      <p className={cx('text-sm', old ? 'font-medium text-brand-red' : 'text-muted')}>{ago(x.last)}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ---------- Equipo ---------- */

/** Roles de una persona en un servicio: "Dirige", "Piano"… */
const rolesIn = (s, person) => [
  ...(s.director === person ? [DIRECTOR_ROLE] : []),
  ...s.band.filter((m) => m.person === person).map((m) => m.instrument),
];

function Team({ range, onPick }) {
  const { index } = useApp();
  const start = rangeStart(range);
  const { data: inRange } = useAsync(
    () => (range === 'all' ? Promise.resolve(null) : queryServices({ from: start, to: todayISO() }).then((r) => r.items)),
    [range],
  );

  const people = useMemo(() => {
    if (range === 'all') {
      return index.people.map((p) => ({ name: p.name, services: p.services, roles: new Map(Object.entries(p.roles)) }));
    }
    const map = new Map();
    (inRange || []).forEach((s) => {
      const names = new Set([s.director, ...s.band.map((m) => m.person)].filter(Boolean));
      names.forEach((p) => {
        const cur = map.get(p) || { name: p, services: 0, roles: new Map() };
        cur.services += 1;
        rolesIn(s, p).forEach((r) => cur.roles.set(r, (cur.roles.get(r) || 0) + 1));
        map.set(p, cur);
      });
    });
    return [...map.values()].sort((a, b) => b.services - a.services || a.name.localeCompare(b.name));
  }, [range, index, inRange]);

  if (!people.length) {
    return <Empty icon={SearchX} title="Nadie ha participado en este periodo">Prueba con otro periodo.</Empty>;
  }

  const max = people[0].services;
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-display text-lg font-bold">Participación</h2>
      <p className="mb-2 text-sm text-muted">Veces que cada persona participó en el periodo.</p>
      <ul className="space-y-1">
        {people.map((p) => (
          <li key={p.name}>
            <button
              type="button"
              onClick={() => onPick({ kind: 'person', value: p.name, range })}
              className="group block w-full rounded-lg px-2 py-1.5 text-left hover:bg-sunken"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="truncate font-medium">{p.name}</span>
                <span className="shrink-0 text-sm tabular-nums text-muted">
                  {plural(p.services, 'servicio', 'servicios')}
                </span>
              </span>
              <span className="block truncate text-sm text-muted">
                {[...p.roles.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([r, n]) => `${r} ${n}`)
                  .join(', ')}
              </span>
              <Bar value={p.services} max={max} color="bg-brand-blue" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- Página ---------- */

export default function Reports() {
  const { navigate, index, version, catalogs } = useApp();
  const [view, setView] = useState('resumen');
  const [range, setRange] = useState('all');
  const [director, setDirector] = useState('');
  const [detail, setDetail] = useState(null); // { kind, value, dates?, range? }

  const today = todayISO();
  const start = rangeStart(range);

  // Solo el resumen necesita los servicios del periodo; Repertorio y Equipo salen del índice.
  const { data: filtered, loading } = useAsync(
    () => (view === 'resumen' ? queryServices({ from: start, to: today, director }).then((r) => r.items) : Promise.resolve(null)),
    [view, start, director, version],
  );

  // Detalle de lo que se tocó: se lee solo lo necesario.
  const { data: detailServices } = useAsync(async () => {
    if (!detail) return [];
    if (detail.kind === 'song') return getServices(detail.dates);
    if (detail.kind === 'person') {
      const r = await queryServices({ from: rangeStart(detail.range), to: today });
      return r.items.filter((s) => rolesIn(s, detail.value).length);
    }
    return (filtered || []).filter((s) =>
      detail.kind === 'artist' ? s.songs.some((x) => x.artist === detail.value) : s.director === detail.value,
    );
  }, [detail]);

  const detailTitle = detail && (detail.kind === 'director' ? `Dirigidos por ${detail.value}` : detail.value);
  const detailKind =
    detail &&
    {
      song: 'Cada vez que se cantó',
      artist: 'Servicios con canciones de este artista',
      director: 'Servicios',
      person: 'Servicios en los que participó',
    }[detail.kind];
  const list = detail ? detailServices || [] : [];

  return (
    <>
      <PageHeader title="Reportes" subtitle="Qué se canta, cuándo y quién participa." />

      <div role="tablist" aria-label="Vista" className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-sunken p-1">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            onClick={() => setView(v.id)}
            className={cx(
              'min-h-10 rounded-lg text-sm font-semibold transition',
              view === v.id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view !== 'repertorio' && (
        <div className="mb-3 space-y-2">
          <ChipRow label="Periodo">
            {RANGES.map((r) => (
              <Chip key={r.id} active={range === r.id} onClick={() => setRange(r.id)}>{r.label}</Chip>
            ))}
          </ChipRow>
          {view === 'resumen' && catalogs.directors.length > 0 && (
            <ChipRow label="Director">
              <Chip active={!director} onClick={() => setDirector('')}>Todos</Chip>
              {catalogs.directors.map((d) => (
                <Chip key={d} active={director === d} onClick={() => setDirector(director === d ? '' : d)}>{d}</Chip>
              ))}
            </ChipRow>
          )}
        </div>
      )}

      {index.serviceCount === 0 ? (
        <Empty
          icon={BarChart3}
          title="Aún no hay servicios"
          action={<button type="button" className="min-h-11 font-semibold underline" onClick={() => navigate('registro')}>Registrar un servicio</button>}
        >
          Registra servicios para ver estadísticas.
        </Empty>
      ) : view === 'repertorio' ? (
        <Repertoire onPick={setDetail} />
      ) : view === 'equipo' ? (
        <Team range={range} onPick={setDetail} />
      ) : !filtered && loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-64" />
        </div>
      ) : !filtered?.length ? (
        <Empty icon={BarChart3} title="No hay servicios en este periodo">
          Prueba con otro periodo o quita el filtro de director.
        </Empty>
      ) : (
        <Summary filtered={filtered} onPick={setDetail} />
      )}

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detailTitle || ''}>
        <p className="mb-3 text-sm text-muted">
          {detailKind}: {plural(list.length, 'servicio', 'servicios')}
        </p>
        <ul className="space-y-2">
          {list.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-line p-2.5">
              <DateBlock fecha={s.fecha} className="w-12 py-1.5" />
              <div className="min-w-0">
                <p className="truncate font-semibold first-letter:uppercase">{longDate(s.fecha).split(',')[1]?.trim() || longDate(s.fecha)}</p>
                <p className="truncate text-sm text-muted">
                  {detail?.kind === 'person' ? rolesIn(s, detail.value).join(', ') : `Dirigió ${s.director}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
