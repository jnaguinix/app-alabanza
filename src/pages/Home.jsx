import { useMemo } from 'react';
import { CalendarPlus, Pencil, Share2 } from 'lucide-react';
import { useApp } from '../app-context';
import { Band, Setlist } from '../components/Setlist';
import { DateBlock, ServiceCard } from '../components/ServiceCard';
import { useShare } from '../components/ShareHost';
import { Button, Empty, Skeleton, cx } from '../components/ui';
import { queryServices } from '../data/store';
import { useAsync } from '../hooks/useAsync';
import { longDate, monthKey, nextSundayISO, todayISO } from '../lib/format';

function Stat({ value, label, subtext, wide }) {
  return (
    <div
      className={cx(
        'rounded-2xl border border-line bg-surface p-3 sm:p-3.5 flex flex-col justify-between transition',
        wide && 'col-span-2 sm:col-span-1'
      )}
    >
      <div>
        <p
          className={cx(
            'font-display font-extrabold text-ink tracking-tight',
            wide
              ? 'text-sm sm:text-base leading-snug line-clamp-2 sm:truncate'
              : 'text-xl sm:text-2xl truncate'
          )}
          title={typeof value === 'string' ? value : undefined}
        >
          {value}
        </p>
      </div>
      <div className="mt-1 flex items-center justify-between gap-1">
        <p className="text-xs text-muted font-medium">{label}</p>
        {subtext && (
          <span className="text-[11px] font-semibold text-brand-blue shrink-0">
            {subtext}
          </span>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const { index, version, navigate, canEdit } = useApp();
  const share = useShare();

  // Tres lecturas pequeñas: el próximo servicio, los últimos 4 y los de este mes.
  const { data, loading } = useAsync(async () => {
    const today = todayISO();
    const [next, latest, month] = await Promise.all([
      queryServices({ from: today, order: 'asc', limit: 1 }),
      queryServices({ to: today, limit: 4 }),
      queryServices({ from: `${monthKey(today)}-01`, to: `${monthKey(today)}-31` }),
    ]);
    const upcoming = next.items[0];
    const current = upcoming || latest.items[0];
    return {
      current,
      upcoming: !!upcoming,
      recent: latest.items.filter((s) => s.id !== current?.id).slice(0, 3),
      monthCount: month.items.length,
    };
  }, [version]);

  const topSong = useMemo(() => [...index.songs].sort((a, b) => b.count - a.count)[0], [index]);
  const { current, upcoming, recent, monthCount } = data || {};

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-72" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  const plan = !upcoming && nextSundayISO();

  if (!current) {
    return (
      <Empty
        icon={CalendarPlus}
        title="Aún no hay servicios"
        action={
          canEdit ? (
            <Button icon={CalendarPlus} onClick={() => navigate('registro')}>
              Registrar el primer servicio
            </Button>
          ) : null
        }
      >
        Registra el repertorio y el equipo de un servicio para verlo aquí.
      </Empty>
    );
  }

  return (
    <div className="space-y-5 md:space-y-8">
      {plan && canEdit && (
        <section className="flex items-center gap-3 rounded-2xl border border-dashed border-brand-blue/50 bg-surface p-3">
          <DateBlock fecha={plan} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-snug">Próximo domingo</p>
            <p className="text-sm text-muted">Aún no tiene servicio</p>
          </div>
          <Button icon={CalendarPlus} className="shrink-0 px-3" onClick={() => navigate('registro', plan)}>
            Planear
          </Button>
        </section>
      )}
      <section aria-labelledby="hero-title" className="overflow-hidden rounded-3xl border border-line bg-surface">
        <div aria-hidden className="grid h-1.5 grid-cols-4">
          <span className="bg-[#B80E0A]" />
          <span className="bg-[#213E91]" />
          <span className="bg-[#FAC20E]" />
          <span className="bg-[#16295F] dark:bg-[#8AA4EE]" />
        </div>
        <div className="bg-[#213E91] px-4 pt-4 pb-3.5 text-white sm:px-6 sm:pt-6 sm:pb-5">
          <p className="text-sm font-semibold text-accent">{upcoming ? 'Próximo servicio' : 'Último servicio'}</p>
          <h1 id="hero-title" className="mt-1 font-display text-2xl font-extrabold tracking-tight first-letter:uppercase sm:text-4xl">
            {longDate(current.fecha)}
          </h1>
          <p className="mt-1 text-[#D6E0FC]">Dirige {current.director || 'por definir'}</p>
        </div>
        <div className="px-4 py-1 sm:px-6 sm:py-3">
          <Setlist songs={current.songs} size="lg" />
        </div>
        {current.band.length > 0 && (
          <div className="border-t border-line px-4 py-3 sm:px-6 sm:py-5">
            <Band band={current.band} />
          </div>
        )}
        <div className="flex gap-3 border-t border-line px-4 py-2.5 sm:px-6 sm:py-4">
          {canEdit && (
            <Button variant="secondary" icon={Pencil} onClick={() => navigate('registro', current.fecha)}>
              Editar
            </Button>
          )}
          <Button variant="secondary" icon={Share2} onClick={() => share(current)}>
            Compartir
          </Button>
        </div>
      </section>

      <section aria-label="Resumen" className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <Stat value={index.serviceCount} label="Servicios" />
        <Stat value={monthCount ?? 0} label="Este mes" />
        <Stat
          value={topSong ? topSong.name : '—'}
          label="Más cantada"
          subtext={topSong?.count ? `${topSong.count} veces` : null}
          wide
        />
      </section>

      {recent.length > 0 && (
        <section aria-labelledby="recent-title">
          <div className="mb-1 flex items-baseline justify-between">
            <h2 id="recent-title" className="font-display text-xl font-bold">Anteriores</h2>
            <button type="button" onClick={() => navigate('historial')} className="min-h-11 px-1 text-sm font-semibold text-muted underline-offset-4 hover:underline">
              Ver historial
            </button>
          </div>
          <div className="space-y-2">
            {recent.map((s) => <ServiceCard key={s.id} service={s} />)}
          </div>
        </section>
      )}
    </div>
  );
}
