import { useState } from 'react';
import { ChevronDown, Pencil, Share2 } from 'lucide-react';
import { dayParts, plural } from '../lib/format';
import { Band, Setlist } from './Setlist';
import { IconButton, cx } from './ui';
import { useShare } from './ShareHost';
import { useApp } from '../app-context';

export function DateBlock({ fecha, className }) {
  const { weekday, day, month } = dayParts(fecha);
  return (
    <div
      className={cx(
        'flex w-12 shrink-0 flex-col items-center rounded-xl bg-sunken py-1.5 leading-none',
        className,
      )}
    >
      <span className="text-xs font-semibold text-muted">{weekday}</span>
      <span className="my-0.5 font-display text-xl font-extrabold">{day}</span>
      <span className="text-xs font-semibold text-brand-blue">{month}</span>
    </div>
  );
}

export function ServiceCard({ service }) {
  const [open, setOpen] = useState(false);
  const share = useShare();
  const { navigate, canEdit } = useApp();
  const panelId = `servicio-${service.id}`;

  return (
    <article className="rounded-2xl border border-line bg-surface">
      <div className="flex items-center gap-2 p-2.5 sm:p-4">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl text-left"
        >
          <DateBlock fecha={service.fecha} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base font-bold">{service.director || 'Sin director'}</p>
            <p className="truncate text-sm text-muted">
              {plural(service.songs.length, 'canción', 'canciones')}
              {service.band.length > 0 && `, ${plural(service.band.length, 'músico', 'músicos')}`}
            </p>
          </div>
          <ChevronDown
            size={20}
            aria-hidden
            className={cx('mr-1 shrink-0 text-muted transition-transform', open && 'rotate-180')}
          />
        </button>
        <div className="hidden gap-1 sm:flex">
          {canEdit && (
            <IconButton icon={Pencil} label="Editar servicio" onClick={() => navigate('registro', service.fecha)} />
          )}
          <IconButton icon={Share2} label="Compartir como imagen" onClick={() => share(service)} />
        </div>
      </div>

      {open && (
        <div id={panelId} className="border-t border-line px-4 pt-2 pb-4 sm:px-5">
          <Setlist songs={service.songs} />
          {service.band.length > 0 && (
            <div className="mt-4">
              <Band band={service.band} />
            </div>
          )}
          <div className="mt-4 flex gap-2 sm:hidden">
            {canEdit && (
              <button
                type="button"
                onClick={() => navigate('registro', service.fecha)}
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-line font-semibold"
              >
                <Pencil size={16} aria-hidden /> Editar
              </button>
            )}
            <button
              type="button"
              onClick={() => share(service)}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-line font-semibold"
            >
              <Share2 size={16} aria-hidden /> Compartir
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
