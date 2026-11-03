import { Fragment, useEffect, useState } from 'react';
import { Calendar, Search, SearchX, X } from 'lucide-react';
import { useApp } from '../app-context';
import { ServiceCard } from '../components/ServiceCard';
import { Button, Chip, Empty, PageHeader, Skeleton, inputClass } from '../components/ui';
import { queryServices } from '../data/store';
import { monthKey, monthLabel } from '../lib/format';

const PAGE_SIZE = 10;

export default function History() {
  const { catalogs, index, version, navigate } = useApp();
  const [query, setQuery] = useState('');
  const [text, setText] = useState(''); // consulta con retraso: no se pide a la base en cada tecla
  const [director, setDirector] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showDates, setShowDates] = useState(false);

  const [items, setItems] = useState([]);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setText(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Primera página: se repite al cambiar filtros o al guardar/borrar un servicio.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    queryServices({ text, director, from, to, limit: PAGE_SIZE }).then((r) => {
      if (cancelled) return;
      setItems(r.items);
      setNext(r.next);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [text, director, from, to, version]);

  const loadMore = async () => {
    setLoadingMore(true);
    const r = await queryServices({ text, director, from, to, limit: PAGE_SIZE, after: next });
    setItems((l) => [...l, ...r.items]);
    setNext(r.next);
    setLoadingMore(false);
  };

  const hasFilters = query || director || from || to;
  const clear = () => {
    setQuery('');
    setText('');
    setDirector('');
    setFrom('');
    setTo('');
  };

  return (
    <>
      <PageHeader title="Historial" subtitle="Todos los servicios, del más reciente al más antiguo." />

      <div className="sticky top-0 z-30 -mx-4 mb-3 space-y-2 bg-bg/95 px-4 py-2 backdrop-blur md:-mx-8 md:px-8">
        <div className="relative">
          <Search size={18} aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca por canción, artista, director o músico"
            aria-label="Buscar servicios"
            className={`${inputClass} pl-10`}
          />
        </div>
        <div className="-mx-4 flex gap-2 no-scrollbar overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          <Chip active={showDates || !!(from || to)} onClick={() => setShowDates(!showDates)}>
            <Calendar size={14} aria-hidden /> Fechas
          </Chip>
          {catalogs.directors.map((d) => (
            <Chip key={d} active={director === d} onClick={() => setDirector(director === d ? '' : d)}>
              {d}
            </Chip>
          ))}
        </div>
        {showDates && (
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-semibold">
              Desde
              <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={`${inputClass} mt-1 font-normal`} />
            </label>
            <label className="text-sm font-semibold">
              Hasta
              <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={`${inputClass} mt-1 font-normal`} />
            </label>
          </div>
        )}
        {hasFilters && (
          <div className="flex items-center justify-between text-sm text-muted">
            <span>{loading ? 'Buscando…' : `${items.length}${next ? '+' : ''} ${items.length === 1 && !next ? 'servicio' : 'servicios'}`}</span>
            <button type="button" onClick={clear} className="inline-flex min-h-9 items-center gap-1 font-semibold text-ink">
              <X size={14} aria-hidden /> Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {loading && items.length === 0 ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : index.serviceCount === 0 ? (
        <Empty icon={Calendar} title="Aún no hay servicios" action={<Button onClick={() => navigate('registro')}>Registrar un servicio</Button>}>
          Cuando guardes un servicio aparecerá aquí.
        </Empty>
      ) : items.length === 0 ? (
        <Empty icon={SearchX} title="Ningún servicio coincide" action={<Button variant="secondary" onClick={clear}>Limpiar filtros</Button>}>
          Prueba con otro nombre o amplía el rango de fechas.
        </Empty>
      ) : (
        <div className="space-y-2">
          {items.map((s, i) => (
            <Fragment key={s.id}>
              {(i === 0 || monthKey(items[i - 1].fecha) !== monthKey(s.fecha)) && (
                <h2 className="pt-3 pb-0.5 font-display text-base font-bold text-muted first:pt-0">{monthLabel(s.fecha)}</h2>
              )}
              <ServiceCard service={s} />
            </Fragment>
          ))}
          {next ? (
            <Button variant="secondary" className="mt-2 w-full" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? 'Cargando…' : 'Mostrar más'}
            </Button>
          ) : (
            <p className="pt-4 text-center text-sm text-muted">Estos son todos los servicios.</p>
          )}
        </div>
      )}
    </>
  );
}
