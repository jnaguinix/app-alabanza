import { useMemo } from 'react';
import { CalendarPlus, Pencil, Share2 } from 'lucide-react';
import { useApp } from '../app-context';
import { Band, Setlist } from '../components/Setlist';
import { DateBlock, ServiceCard } from '../components/ServiceCard';
import { useShare } from '../components/ShareHost';
import { Button, Empty, Skeleton } from '../components/ui';
import { queryServices } from '../data/store';
import { useAsync } from '../hooks/useAsync';
import { longDate, monthKey, nextSundayISO, todayISO } from '../lib/format';

function Stat({ value, label }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="truncate font-display text-xl font-extrabold">{value}</p>
      <p className="mt-0.5 text-sm text-muted">{label}</p>
    </div>
  );
}

export default function Home() {
  const { index, version, navigate } = useApp();
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
        action={<Button icon={CalendarPlus} onClick={() => navigate('registro')}>Registrar el primer servicio</Button>}
      >
        Registra el repertorio y el equipo de un servicio para verlo aquí.
      </Empty>
    );
  }

  return (
    <div className="space-y-5 md:space-y-8">
      {plan && (
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
          <Button variant="secondary" icon={Pencil} onClick={() => navigate('registro', current.fecha)}>Editar</Button>
          <Button variant="secondary" icon={Share2} onClick={() => share(current)}>Compartir</Button>
        </div>
      </section>

      <section aria-label="Resumen" className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat value={index.serviceCount} label="Servicios" />
        <Stat value={monthCount} label="Este mes" />
        <Stat value={topSong ? topSong.name : '—'} label="Más cantada" />
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
