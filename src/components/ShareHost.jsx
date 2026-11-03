import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as htmlToImage from 'html-to-image';
import { Copy, Image as ImageIcon, MessageSquareText } from 'lucide-react';
import { useApp } from '../app-context';
import { longDate } from '../lib/format';
import { groupBand } from './Setlist';
import { Sheet } from './ui';

const ShareContext = createContext(() => {});
export const useShare = () => useContext(ShareContext);

/** Tarjeta 1080x1350 con colores propios (no depende del tema de la app). */
function ShareCard({ service, cardRef }) {
  const band = groupBand(service.band);
  return (
    <div
      ref={cardRef}
      style={{ width: 1080, height: 1350, background: '#0B1226', color: '#EEF2FC', fontFamily: 'Figtree, sans-serif' }}
      className="relative flex flex-col p-[84px]"
    >
      <div className="absolute inset-x-0 top-0 grid h-4 grid-cols-4">
        <span style={{ background: '#B80E0A' }} />
        <span style={{ background: '#213E91' }} />
        <span style={{ background: '#FAC20E' }} />
        <span style={{ background: '#8AA4EE' }} />
      </div>
      <p style={{ color: '#FAC20E', fontFamily: '"Bricolage Grotesque", sans-serif' }} className="text-[34px] font-bold">
        AlabanzApp
      </p>
      <h2
        style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}
        className="mt-6 text-[84px] leading-[1.02] font-extrabold first-letter:uppercase"
      >
        {longDate(service.fecha).split(' de ').slice(0, 2).join(' de ')}
      </h2>
      <p style={{ color: '#A2AECB' }} className="mt-3 text-[34px]">
        Dirige {service.director || 'por definir'}
      </p>
      <ol className="mt-14 flex-1 space-y-7">
        {service.songs.map((s, i) => (
          <li key={i} className="flex items-baseline gap-7">
            <span
              style={{ color: '#FAC20E', fontFamily: '"Bricolage Grotesque", sans-serif' }}
              className="w-12 text-right text-[44px] font-bold"
            >
              {i + 1}
            </span>
            <div>
              <p style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }} className="text-[50px] leading-tight font-bold">
                {s.name}
              </p>
              <p style={{ color: '#A2AECB' }} className="text-[28px]">{s.artist}</p>
            </div>
          </li>
        ))}
      </ol>
      {band.length > 0 && (
        <div style={{ borderColor: '#25335C' }} className="grid grid-cols-2 gap-x-10 gap-y-3 border-t-2 pt-9 text-[26px]">
          {band.map(([instrument, people]) => (
            <p key={instrument}>
              <span style={{ color: '#A2AECB' }}>{instrument}: </span>
              {people.join(', ')}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Texto listo para WhatsApp (los asteriscos son negrita allí). */
export function serviceText(s) {
  const lines = [`*Servicio del ${longDate(s.fecha)}*`, `Dirige: ${s.director || 'por definir'}`, '', '*Canciones*'];
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
