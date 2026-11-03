import { cx } from './ui';

/** Canciones en orden de interpretación: aquí la numeración sí es información. */
export function Setlist({ songs, size = 'md' }) {
  if (!songs.length) return <p className="text-muted">Sin canciones registradas.</p>;
  const big = size === 'lg';
  return (
    <ol className={cx('divide-y divide-line', big && 'divide-line/70')}>
      {songs.map((s, i) => (
        <li key={`${s.name}-${i}`} className={cx('flex items-baseline gap-4', big ? 'py-2' : 'py-1.5')}>
          <span className={cx('w-6 shrink-0 text-right font-display font-bold text-brand-blue', big ? 'text-xl' : 'text-base')}>
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className={cx('font-display font-bold leading-tight', big ? 'text-xl' : 'text-base')}>{s.name}</p>
            <p className="text-sm text-muted">{s.artist}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function groupBand(band) {
  const map = new Map();
  band.forEach((m) => map.set(m.instrument, [...(map.get(m.instrument) || []), m.person]));
  return [...map.entries()];
}

export function Band({ band }) {
  if (!band.length) return <p className="text-muted">Sin músicos registrados.</p>;
  return (
    <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
      {groupBand(band).map(([instrument, people]) => (
        <div key={instrument} className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-2">
          <dt className="text-sm text-muted">{instrument}</dt>
          <dd className="text-right font-medium">{people.join(', ')}</dd>
        </div>
      ))}
    </dl>
  );
}
