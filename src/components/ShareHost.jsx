import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as htmlToImage from 'html-to-image';
import { Copy, Image as ImageIcon, MessageSquareText } from 'lucide-react';
import { useApp } from '../app-context';
import { formatDirectors, longDate } from '../lib/format';
import { groupBand } from './Setlist';
import { Sheet } from './ui';

const ShareContext = createContext(() => {});
export const useShare = () => useContext(ShareContext);

/** Tarjeta 1080x1350 en modo blanco / claro de alta calidad gráfica para exportar y compartir. */
function ShareCard({ service, cardRef }) {
  const band = groupBand(service.band);
  const directorText = service.directors?.length
    ? formatDirectors(service.directors)
    : service.director || 'Por definir';
  const isMultiple = (service.directors && service.directors.length > 1) || (directorText.includes(' y '));

  return (
    <div
      ref={cardRef}
      style={{
        width: 1080,
        height: 1350,
        background: '#FFFFFF',
        color: '#0F1B3D',
        fontFamily: 'Figtree, sans-serif',
      }}
      className="relative flex flex-col justify-between p-[76px] box-border"
    >
      {/* Barra superior con los colores emblemáticos */}
      <div className="absolute inset-x-0 top-0 grid h-3.5 grid-cols-4">
        <span style={{ background: '#B80E0A' }} />
        <span style={{ background: '#213E91' }} />
        <span style={{ background: '#FAC20E' }} />
        <span style={{ background: '#8AA4EE' }} />
      </div>

      {/* Cabecera con Marca y Etiqueta */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <span
              style={{
                background: '#213E91',
                color: '#FFFFFF',
                fontFamily: '"Bricolage Grotesque", sans-serif',
              }}
              className="flex size-14 items-center justify-center rounded-2xl text-[30px] font-extrabold shadow-sm"
            >
              A
            </span>
            <span
              style={{
                color: '#213E91',
                fontFamily: '"Bricolage Grotesque", sans-serif',
              }}
              className="text-[38px] font-extrabold tracking-tight"
            >
              AlabanzApp
            </span>
          </div>

          <span
            style={{
              background: '#FFF1BD',
              color: '#0F1B3D',
              borderColor: '#FAC20E',
            }}
            className="rounded-full border px-5 py-2 text-[22px] font-bold"
          >
            Servicio de Alabanza
          </span>
        </div>

        {/* Fecha y Dirección */}
        <h2
          style={{
            fontFamily: '"Bricolage Grotesque", sans-serif',
            color: '#0F1B3D',
          }}
          className="mt-8 text-[76px] leading-[1.05] font-extrabold tracking-tight first-letter:uppercase"
        >
          {longDate(service.fecha).split(' de ').slice(0, 2).join(' de ')}
        </h2>

        <p className="mt-2.5 text-[32px] text-[#55607F]">
          <span className="font-medium">
            {isMultiple ? 'Dirigen: ' : 'Dirige: '}
          </span>
          <strong style={{ color: '#213E91' }} className="font-bold">
            {directorText}
          </strong>
        </p>
      </div>

      {/* Lista de Canciones */}
      <div className="my-6 flex-1 flex flex-col justify-center">
        <ol className="space-y-5">
          {service.songs.map((s, i) => (
            <li key={i} className="flex items-baseline gap-6">
              <span
                style={{
                  background: '#E9EDF6',
                  color: '#213E91',
                  fontFamily: '"Bricolage Grotesque", sans-serif',
                }}
                className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-[30px] font-bold"
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  style={{
                    fontFamily: '"Bricolage Grotesque", sans-serif',
                    color: '#0F1B3D',
                  }}
                  className="text-[44px] leading-tight font-bold tracking-tight"
                >
                  {s.name}
                </p>
                <p style={{ color: '#55607F' }} className="text-[26px] font-medium">
                  {s.artist}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Músicos y Coristas (Banda) */}
      {band.length > 0 && (
        <div
          style={{
            borderColor: '#D9DFEC',
            background: '#F8FAFC',
          }}
          className="rounded-3xl border-2 p-7"
        >
          <div className="grid grid-cols-2 gap-x-10 gap-y-3 text-[24px]">
            {band.map(([instrument, people]) => (
              <p key={instrument} className="truncate">
                <span style={{ color: '#55607F' }}>{instrument}: </span>
                <strong style={{ color: '#0F1B3D' }} className="font-semibold">
                  {people.join(', ')}
                </strong>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Texto listo para WhatsApp (los asteriscos son negrita allí). */
export function serviceText(s) {
  const directorText = s.directors?.length ? formatDirectors(s.directors) : s.director || 'por definir';
  const isMultiple = (s.directors && s.directors.length > 1) || (directorText.includes(' y '));
  const lines = [
    `*Servicio del ${longDate(s.fecha)}*`,
    `${isMultiple ? 'Dirigen' : 'Dirige'}: ${directorText}`,
    '',
    '*Canciones*',
  ];
  s.songs.forEach((x, i) => lines.push(`${i + 1}. ${x.name} (${x.artist})`));
  if (s.band.length) {
    lines.push('', '*Músicos*');
    groupBand(s.band).forEach(([instrument, people]) => lines.push(`${instrument}: ${people.join(', ')}`));
  }
  return lines.join('\n');
}

function ShareOption({ icon: Icon, title, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl border border-line p-3 text-left hover:bg-sunken"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sunken text-brand-blue">
        <Icon size={22} aria-hidden />
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted">{children}</span>
      </span>
    </button>
  );
}

export function ShareHost({ children }) {
  const { toast } = useApp();
  const [picking, setPicking] = useState(null);
  const [service, setService] = useState(null);
  const ref = useRef(null);

  const share = useCallback((s) => setPicking(s), []);

  const shareText = async (s) => {
    setPicking(null);
    const text = serviceText(s);
    try {
      if (navigator.share) {
        await navigator.share({ text });
        toast('Servicio compartido');
      } else {
        await navigator.clipboard.writeText(text);
        toast('Texto copiado. Pégalo en el chat del equipo.');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') toast('No se pudo compartir el texto.', 'error');
    }
  };

  const copyText = async (s) => {
    setPicking(null);
    try {
      await navigator.clipboard.writeText(serviceText(s));
      toast('Texto copiado. Pégalo en el chat del equipo.');
    } catch {
      toast('No se pudo copiar el texto.', 'error');
    }
  };

  useEffect(() => {
    if (!service) return;
    let cancelled = false;
    (async () => {
      try {
        await document.fonts.ready;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const dataUrl = await htmlToImage.toPng(ref.current, { pixelRatio: 1, cacheBust: true });
        if (cancelled) return;
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `servicio-${service.fecha}.png`, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Servicio de alabanza' });
          toast('Servicio compartido');
        } else {
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = file.name;
          a.click();
          toast('Imagen descargada. Ya puedes compartirla.');
        }
      } catch (err) {
        if (err?.name !== 'AbortError') toast('No se pudo crear la imagen. Inténtalo de nuevo.', 'error');
      } finally {
        if (!cancelled) setService(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [service, toast]);

  return (
    <ShareContext.Provider value={share}>
      {children}
      <Sheet open={!!picking} onClose={() => setPicking(null)} title="Compartir servicio">
        <div className="space-y-2">
          <ShareOption icon={ImageIcon} title="Como imagen" onClick={() => { setService(picking); setPicking(null); }}>
            Una tarjeta con las canciones y la banda.
          </ShareOption>
          <ShareOption icon={MessageSquareText} title="Como texto" onClick={() => shareText(picking)}>
            Mensaje listo para WhatsApp.
          </ShareOption>
          <ShareOption icon={Copy} title="Copiar texto" onClick={() => copyText(picking)}>
            Para pegarlo donde quieras.
          </ShareOption>
        </div>
      </Sheet>
      {service && (
        <div aria-hidden className="pointer-events-none fixed top-0 -left-[10000px]">
          <ShareCard service={service} cardRef={ref} />
        </div>
      )}
    </ShareContext.Provider>
  );
}
