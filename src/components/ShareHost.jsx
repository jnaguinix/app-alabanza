import { createContext, useCallback, useContext, useState } from 'react';
import { Copy, Image as ImageIcon, MessageSquareText } from 'lucide-react';
import { useApp } from '../app-context';
import { formatDirectors, longDate } from '../lib/format';
import { groupBand } from './Setlist';
import { Sheet } from './ui';

const ShareContext = createContext(() => {});
export const useShare = () => useContext(ShareContext);

/** Dibuja un rectángulo con bordes redondeados en el contexto 2D. */
function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Divide un texto en líneas que no superen `maxWidth`. */
function wrapTextLines(ctx, text, maxWidth) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

/**
 * Renderiza la tarjeta del servicio en un Canvas 2D fijo de 1080x1350.
 * Incluye el encabezado azul institucional de Inicio y tipografía amplia.
 * 100% independiente del tamaño de pantalla del celular o navegador móvil.
 */
async function renderServiceCardToBlob(service) {
  const WIDTH = 1080;
  const HEIGHT = 1350;
  const PAD = 64;
  const CONTENT_W = WIDTH - PAD * 2; // 952px

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
      await Promise.allSettled([
        document.fonts.load('800 82px "Bricolage Grotesque"'),
        document.fonts.load('700 58px "Bricolage Grotesque"'),
        document.fonts.load('800 38px "Figtree"'),
        document.fonts.load('700 38px "Figtree"'),
        document.fonts.load('500 36px "Figtree"'),
      ]);
    }
  } catch {
    // Continuar con fuentes del sistema si alguna falla al cargar
  }

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');

  // 1. Fondo blanco general
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 2. Calcular dimensiones del encabezado azul (#213E91)
  const topBarH = 18;
  const headerPadTop = 54;
  const headerPadBottom = 50;

  // Fecha en una sola línea auto-ajustable
  const rawDate = longDate(service.fecha).split(' de ').slice(0, 2).join(' de ');
  const dateText = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);

  let dateFontSize = 82;
  while (dateFontSize > 40) {
    ctx.font = `800 ${dateFontSize}px "Bricolage Grotesque", sans-serif`;
    if (ctx.measureText(dateText).width <= CONTENT_W) break;
    dateFontSize -= 1;
  }

  // Etiqueta visual de quien dirige
  const directorText = service.directors?.length
    ? formatDirectors(service.directors)
    : service.director || 'Por definir';
  const isMultiple =
    (service.directors && service.directors.length > 1) || directorText.includes(' y ');
  const prefixText = isMultiple ? 'Dirigen: ' : 'Dirige: ';

  const dateTopY = topBarH + headerPadTop;
  const badgeTopY = dateTopY + Math.round(dateFontSize * 1.15) + 24;
  const badgePadX = 30;
  const badgePadY = 16;
  const dotRadius = 7;
  const dotGap = 16;

  let badgeFontSize = 38;
  let prefixW = 0;
  let directorW = 0;

  while (badgeFontSize > 22) {
    ctx.font = `600 ${badgeFontSize}px "Figtree", sans-serif`;
    prefixW = ctx.measureText(prefixText).width;
    ctx.font = `800 ${badgeFontSize}px "Figtree", sans-serif`;
    directorW = ctx.measureText(directorText).width;
    const totalNeeded = badgePadX * 2 + dotRadius * 2 + dotGap + prefixW + directorW;
    if (totalNeeded <= CONTENT_W) break;
    badgeFontSize -= 1;
  }

  const pillW = Math.min(
    CONTENT_W,
    Math.ceil(badgePadX * 2 + dotRadius * 2 + dotGap + prefixW + directorW)
  );
  const pillH = Math.round(badgeFontSize + badgePadY * 2);
  const headerBottomY = badgeTopY + pillH + headerPadBottom;

  // Dibujar bloque azul superior
  ctx.fillStyle = '#213E91';
  ctx.fillRect(0, topBarH, WIDTH, headerBottomY - topBarH);

  // Dibujar franja superior de 4 colores institucionales
  const barColors = ['#B80E0A', '#213E91', '#FAC20E', '#8AA4EE'];
  const segW = WIDTH / 4;
  barColors.forEach((color, idx) => {
    ctx.fillStyle = color;
    ctx.fillRect(idx * segW, 0, segW, topBarH);
  });

  // Dibujar texto de fecha en blanco
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `800 ${dateFontSize}px "Bricolage Grotesque", sans-serif`;
  ctx.fillText(dateText, PAD, dateTopY);

  // Dibujar etiqueta destacada para quien dirige sobre el fondo azul
  drawRoundedRect(ctx, PAD, badgeTopY, pillW, pillH, 22);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.stroke();

  const centerY = badgeTopY + pillH / 2;
  const dotCenterX = PAD + badgePadX + dotRadius;
  ctx.beginPath();
  ctx.arc(dotCenterX, centerY, dotRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#FAC20E';
  ctx.fill();

  const textStartX = dotCenterX + dotRadius + dotGap;
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${badgeFontSize}px "Figtree", sans-serif`;
  ctx.fillStyle = '#D6E0FC';
  ctx.fillText(prefixText, textStartX, centerY + 1);

  ctx.font = `800 ${badgeFontSize}px "Figtree", sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(directorText, textStartX + prefixW, centerY + 1);

  // 3. Calcular y dibujar tarjeta inferior de Músicos y Coristas en 2 columnas con letra grande
  const band = groupBand(service.band || []);
  const bottomMargin = 58;
  let songsBottomLimit = HEIGHT - bottomMargin;

  if (band.length > 0) {
    const boxPadX = 44;
    const boxPadY = 38;
    const colGap = 44;
    const rowGap = 24;
    const colW = (CONTENT_W - boxPadX * 2 - colGap) / 2;
    const bandFontSize = band.length > 6 ? 34 : 38;
    const bandLineH = Math.round(bandFontSize * 1.3);

    const rows = [];
    for (let i = 0; i < band.length; i += 2) {
      const cells = band.slice(i, i + 2).map(([instrument, people]) => {
        const label = `${instrument}: `;
        const names = people.join(', ');
        ctx.font = `700 ${bandFontSize}px "Figtree", sans-serif`;
        const wrapped = wrapTextLines(ctx, `${label}${names}`, colW);
        return { instrument, label, names, linesCount: wrapped.length };
      });
      const maxLines = Math.max(...cells.map((c) => c.linesCount), 1);
      rows.push({ cells, height: maxLines * bandLineH });
    }

    const totalRowsH =
      rows.reduce((acc, r) => acc + r.height, 0) + Math.max(0, rows.length - 1) * rowGap;
    const boxH = boxPadY * 2 + totalRowsH;
    const boxTopY = HEIGHT - bottomMargin - boxH;
    songsBottomLimit = boxTopY - 34;

    // Contenedor de la banda
    drawRoundedRect(ctx, PAD, boxTopY, CONTENT_W, boxH, 32);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#CBD5E1';
    ctx.stroke();

    let curRowY = boxTopY + boxPadY;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    rows.forEach((row) => {
      row.cells.forEach((cell, colIdx) => {
        const cellX = PAD + boxPadX + colIdx * (colW + colGap);
        ctx.font = `500 ${bandFontSize}px "Figtree", sans-serif`;
        const labelW = ctx.measureText(cell.label).width;
        ctx.fillStyle = '#55607F';
        ctx.fillText(cell.label, cellX, curRowY);

        ctx.font = `700 ${bandFontSize}px "Figtree", sans-serif`;
        ctx.fillStyle = '#0F1B3D';
        const firstLineAvail = Math.max(60, colW - labelW);
        const words = cell.names.split(/\s+/).filter(Boolean);
        let line1 = '';
        let wordIdx = 0;

        while (wordIdx < words.length) {
          const test = line1 ? `${line1} ${words[wordIdx]}` : words[wordIdx];
          if (ctx.measureText(test).width <= firstLineAvail || !line1) {
            line1 = test;
            wordIdx++;
          } else {
            break;
          }
        }
        ctx.fillText(line1, cellX + labelW, curRowY);

        if (wordIdx < words.length) {
          const restText = words.slice(wordIdx).join(' ');
          const extraLines = wrapTextLines(ctx, restText, colW);
          extraLines.forEach((ln, idx) => {
            ctx.fillText(ln, cellX, curRowY + (idx + 1) * bandLineH);
          });
        }
      });
      curRowY += row.height + rowGap;
    });
  }

  // 4. Dibujar repertorio de canciones con tipografía grande y divisores sutiles
  const songs = service.songs || [];
  if (songs.length > 0) {
    const songsTopLimit = headerBottomY + 34;
    const availH = Math.max(220, songsBottomLimit - songsTopLimit);

    let titleSize = 58;
    let artistSize = 36;
    let itemGap = 44;
    let badgeSize = 72;

    const measureSongBlock = () => {
      const textMaxW = CONTENT_W - badgeSize - 28;
      const measured = songs.map((s) => {
        ctx.font = `700 ${titleSize}px "Bricolage Grotesque", sans-serif`;
        const titleLines = wrapTextLines(ctx, s.name, textMaxW);
        const titleH = titleLines.length * Math.round(titleSize * 1.15);
        const artistH = Math.round(artistSize * 1.28);
        const h = Math.max(badgeSize, titleH + 8 + artistH);
        return { song: s, titleLines, titleH, artistH, h };
      });
      const totalH =
        measured.reduce((acc, m) => acc + m.h, 0) + Math.max(0, measured.length - 1) * itemGap;
      return { measured, totalH };
    };

    let layout = measureSongBlock();
    while (layout.totalH > availH && titleSize > 32) {
      titleSize -= 2;
      artistSize = Math.max(22, Math.round(titleSize * 0.62));
      itemGap = Math.max(20, itemGap - 3);
      badgeSize = Math.max(48, Math.round(titleSize * 1.24));
      layout = measureSongBlock();
    }

    const textLeftX = PAD + badgeSize + 28;
    let curSongY = songsTopLimit + Math.max(0, (availH - layout.totalH) / 2);

    layout.measured.forEach((item, idx) => {
      // Recuadro con el número de canción
      drawRoundedRect(ctx, PAD, curSongY + 4, badgeSize, badgeSize, 20);
      ctx.fillStyle = '#E9EDF6';
      ctx.fill();

      ctx.font = `800 ${Math.round(badgeSize * 0.53)}px "Bricolage Grotesque", sans-serif`;
      ctx.fillStyle = '#213E91';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(idx + 1), PAD + badgeSize / 2, curSongY + 4 + badgeSize / 2 + 1);

      // Título de la canción
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = `700 ${titleSize}px "Bricolage Grotesque", sans-serif`;
      ctx.fillStyle = '#0F1B3D';
      const titleLineStep = Math.round(titleSize * 1.15);
      item.titleLines.forEach((ln, lIdx) => {
        ctx.fillText(ln, textLeftX, curSongY + lIdx * titleLineStep);
      });

      // Artista
      ctx.font = `500 ${artistSize}px "Figtree", sans-serif`;
      ctx.fillStyle = '#55607F';
      ctx.fillText(item.song.artist || '', textLeftX, curSongY + item.titleH + 8);

      // Línea divisora sutil entre canciones (como en la tarjeta de Inicio)
      if (idx < layout.measured.length - 1) {
        const dividerY = Math.round(curSongY + item.h + itemGap / 2);
        ctx.beginPath();
        ctx.moveTo(PAD, dividerY);
        ctx.lineTo( WIDTH - PAD, dividerY);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#E9EDF6';
        ctx.stroke();
      }

      curSongY += item.h + itemGap;
    });
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('No se pudo generar la imagen'));
    }, 'image/png');
  });
}

/** Texto listo para WhatsApp (los asteriscos son negrita allí). */
export function serviceText(s) {
  const directorText = s.directors?.length ? formatDirectors(s.directors) : s.director || 'por definir';
  const isMultiple = (s.directors && s.directors.length > 1) || directorText.includes(' y ');
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

function ShareOption({ icon: Icon, title, children, onClick, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl border border-line p-3 text-left hover:bg-sunken disabled:opacity-50"
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
  const [exportingImage, setExportingImage] = useState(false);

  const share = useCallback((s) => setPicking(s), []);

  const shareImage = async (s) => {
    if (!s || exportingImage) return;
    setPicking(null);
    setExportingImage(true);
    try {
      const blob = await renderServiceCardToBlob(s);
      const file = new File([blob], `servicio-${s.fecha}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Servicio de alabanza' });
        toast('Servicio compartido');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        toast('Imagen descargada. Ya puedes compartirla.');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        toast('No se pudo crear la imagen. Inténtalo de nuevo.', 'error');
      }
    } finally {
      setExportingImage(false);
    }
  };

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

  return (
    <ShareContext.Provider value={share}>
      {children}
      <Sheet open={!!picking} onClose={() => setPicking(null)} title="Compartir servicio">
        <div className="space-y-2">
          <ShareOption
            icon={ImageIcon}
            title="Como imagen"
            disabled={exportingImage}
            onClick={() => shareImage(picking)}
          >
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
    </ShareContext.Provider>
  );
}
