import { useEffect, useState, useMemo } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, History, Info, LogIn, Plus, Save, Trash2, X } from 'lucide-react';
import { useApp } from '../app-context';
import { Band, Setlist } from '../components/Setlist';
import { Button, Field, IconButton, PageHeader, cx, inputClass } from '../components/ui';
import { getService } from '../data/store';
import { ago, dayParts, daysBetween, formatDirectors, keyOf, longDate, plural, todayISO } from '../lib/format';

const uid = () => crypto.randomUUID();
const blankSong = () => ({ key: uid(), name: '', artist: '' });
const blankMember = () => ({ key: uid(), instrument: '', person: '' });

const DEFAULT_INSTRUMENTS = [
  'Voz',
  'Voz principal',
  'Coros',
  'Piano',
  'Teclado',
  'Sintetizador',
  'Guitarra acústica',
  'Guitarra eléctrica',
  'Bajo',
  'Batería',
  'Percusión',
  'Saxofón',
  'Violín',
  'Dirección',
];

const extractDirectors = (s) => {
  if (!s) return [];
  if (Array.isArray(s.directors) && s.directors.length) return s.directors;
  if (!s.director) return [];
  const parts = s.director.split(/\s*(?:\/|\by\b|\be\b)\s*/i).map((x) => x.trim()).filter(Boolean);
  return parts.length ? parts : [s.director.trim()];
};

const STEPS = ['Datos', 'Canciones', 'Músicos', 'Resumen'];

function Stepper({ step, maxStep, onGo, editing }) {
  return (
    <nav aria-label="Pasos del registro" className="mb-4">
      <ol className="flex items-center">
        {STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={label} className={cx('flex items-center', i < STEPS.length - 1 && 'flex-1')}>
              <button
                type="button"
                disabled={i > maxStep}
                aria-current={current ? 'step' : undefined}
                aria-label={`Paso ${i + 1}: ${label}`}
                onClick={() => onGo(i)}
                className="flex items-center gap-2 rounded-full disabled:cursor-default"
              >
                <span
                  className={cx(
                    'flex size-8 items-center justify-center rounded-full border text-sm font-bold transition',
                    current && 'border-accent bg-accent text-accent-ink',
                    done && 'border-accent bg-accent-soft text-ink',
                    !current && !done && 'border-line bg-surface text-muted',
                  )}
                >
                  {done ? <Check size={16} aria-hidden /> : i + 1}
                </span>
                <span className={cx('hidden text-sm font-semibold sm:inline', current ? 'text-ink' : 'text-muted')}>{label}</span>
              </button>
              {i < STEPS.length - 1 && <span aria-hidden className={cx('mx-2 h-0.5 flex-1 rounded-full', done ? 'bg-accent' : 'bg-line')} />}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-sm font-semibold md:hidden">
        {editing ? 'Editando' : 'Nuevo servicio'}: paso {step + 1} de {STEPS.length},{' '}
        <span className="text-muted">{STEPS[step].toLowerCase()}</span>
      </p>
    </nav>
  );
}

function Card({ title, hint, action, children }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const clean = (songs, band) => ({
  songs: songs.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), artist: s.artist.trim() || 'Desconocido' })),
  band: band.filter((m) => m.instrument.trim() && m.person.trim()).map((m) => ({ instrument: m.instrument.trim(), person: m.person.trim() })),
});
const snapshot = (directors, songs, band) =>
  JSON.stringify({ directors: [...directors].sort(), ...clean(songs, band) });

/** Cuándo se cantó por última vez la canción antes de este servicio (lee el índice, no los servicios). */
function RepeatHint({ name, fecha, songByKey }) {
  const key = keyOf(name);
  if (key.length < 2) return null;
  const dates = (songByKey.get(key)?.dates || []).filter((d) => d !== fecha);
  if (!dates.length) {
    return <p className="col-start-2 -mt-1 text-sm text-muted">Canción nueva en el repertorio.</p>;
  }
  const last = dates.find((d) => d < fecha);
  if (!last) return null;
  const recent = daysBetween(last, fecha) <= 28;
  return (
    <p
      className={cx(
        'col-start-2 -mt-1 flex items-center gap-1.5 text-sm',
        recent ? 'w-fit rounded-lg bg-accent-soft px-2 py-1 font-medium text-ink' : 'text-muted',
      )}
    >
      {recent && <History size={14} aria-hidden />}
      Se cantó {ago(last, fecha)}
      <span className="font-normal text-muted">({dayParts(last).day} {dayParts(last).month})</span>
    </p>
  );
}

export default function Editor() {
  const { editDate, catalogs, save, remove, toast, navigate, setDirty, isAdmin, canEdit } = useApp();
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [fecha, setFecha] = useState(editDate || todayISO());
  const [directors, setDirectors] = useState([]);
  const [songs, setSongs] = useState([blankSong()]);
  const [band, setBand] = useState([]);
  const [exists, setExists] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [baseline, setBaseline] = useState(null);

  useEffect(() => {
    if (!fecha) return;
    let cancelled = false;
    getService(fecha).then((s) => {
      if (cancelled) return;
      const loadedSongs = s?.songs.length ? s.songs.map((x) => ({ ...x, key: uid() })) : [blankSong()];
      const loadedBand = s ? s.band.map((m) => ({ ...m, key: uid() })) : [];
      const loadedDirectors = extractDirectors(s);
      setErrors({});
      setExists(!!s);
      setDirectors(loadedDirectors);
      setSongs(loadedSongs);
      setBand(loadedBand);
      setBaseline(snapshot(loadedDirectors, loadedSongs, loadedBand));
      if (s) setMaxStep(STEPS.length - 1);
    });
    return () => {
      cancelled = true;
    };
  }, [fecha]);

  const dirty = baseline !== null && snapshot(directors, songs, band) !== baseline;

  useEffect(() => {
    setDirty(dirty);
    if (!dirty) return;
    const onUnload = (e) => e.preventDefault();
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty, setDirty]);

  useEffect(() => () => setDirty(false), [setDirty]);

  const { songs: cleanSongs, band: cleanBand } = clean(songs, band);

  const availableDirectors = useMemo(
    () => catalogs.directors.filter((d) => !directors.includes(d)),
    [catalogs.directors, directors]
  );

  const otherTeamMembers = useMemo(
    () => catalogs.people.filter((p) => !catalogs.directors.includes(p) && !directors.includes(p)),
    [catalogs.people, catalogs.directors, directors]
  );

  const availableInstruments = useMemo(() => {
    const list = [...new Set([...DEFAULT_INSTRUMENTS, ...(catalogs.instruments || [])])];
    return list;
  }, [catalogs.instruments]);

  const addDirector = (name) => {
    if (!name) return;
    if (!directors.includes(name)) {
      setDirectors((curr) => [...curr, name]);
      setErrors((errs) => {
        const next = { ...errs };
        delete next.directors;
        return next;
      });
    }
  };

  const removeDirector = (name) => {
    setDirectors((curr) => curr.filter((d) => d !== name));
  };

  const validate = (n) => {
    const next = {};
    if (n === 0) {
      if (!fecha) next.fecha = 'Elige la fecha del servicio.';
      if (!directors.length) next.directors = 'Selecciona al menos un director del equipo.';
    }
    if (n === 1 && !cleanSongs.length) next.songs = 'Añade al menos una canción.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goTo = (n) => {
    if (n > step) {
      for (let i = step; i < n; i++) if (!validate(i)) return setStep(i);
    }
    setErrors({});
    setStep(n);
    setMaxStep((m) => Math.max(m, n));
    window.scrollTo({ top: 0 });
  };

  const updateSong = (key, patch) => setSongs((l) => l.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const updateMember = (key, patch) => setBand((l) => l.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  const moveSong = (i, dir) =>
    setSongs((l) => {
      const next = [...l];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });

  const onSongName = (key, name) => {
    const known = catalogs.songByKey.get(keyOf(name));
    updateSong(key, known ? { name, artist: known.artist } : { name });
  };

  const handleSave = async () => {
    for (let i = 0; i < 2; i++) {
      if (!validate(i)) {
        setStep(i);
        return;
      }
    }
    setSaving(true);
    try {
      await save({
        fecha,
        director: formatDirectors(directors),
        directors,
        songs: cleanSongs,
        band: cleanBand,
      });
      toast(exists ? 'Cambios guardados' : 'Servicio guardado');
      navigate('inicio', null, { force: true });
    } catch (err) {
      toast(err.message || 'No se pudo guardar el servicio.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const original = await getService(fecha);
    await remove(fecha);
    navigate('historial', null, { force: true });
    toast('Servicio eliminado', 'ok', {
      label: 'Deshacer',
      onClick: async () => {
        await save(original);
        toast('Servicio restaurado');
      },
    });
  };

  const last = step === STEPS.length - 1;

  return (
    <>
      <PageHeader title={exists ? 'Editar servicio' : 'Nuevo servicio'} />
      {!canEdit && (
        <div className="mb-4 rounded-2xl border border-line bg-accent-soft p-3 text-sm font-medium text-ink">
          Tu rol actual es de Visualizador. No tienes permisos para modificar este servicio.
        </div>
      )}
      <Stepper step={step} maxStep={maxStep} onGo={goTo} editing={exists} />

      <div className="pb-36 md:pb-4">
        {step === 0 && (
          <Card title="¿Cuándo y quién dirige?">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                error={errors.fecha}
                hint={fecha ? longDate(fecha) : undefined}
              />

              <Field label="Director(es) de alabanza" error={errors.directors}>
                {() => (
                  <div className="space-y-2.5">
                    {directors.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {directors.map((name) => (
                          <span
                            key={name}
                            className="inline-flex items-center gap-1.5 rounded-full border border-brand-blue/30 bg-brand-blue/10 px-3 py-1 text-sm font-semibold text-ink"
                          >
                            <span>{name}</span>
                            <button
                              type="button"
                              onClick={() => removeDirector(name)}
                              className="rounded-full p-0.5 text-muted hover:bg-black/10 hover:text-ink transition"
                              aria-label={`Quitar a ${name}`}
                            >
                              <X size={14} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            addDirector(e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className={cx(inputClass, errors.directors && 'border-danger')}
                        aria-label="Añadir director del equipo oficial"
                      >
                        <option value="">+ Añadir director del directorio oficial…</option>
                        {availableDirectors.map((name) => (
                          <option key={name} value={name}>
                            {name} (Director oficial)
                          </option>
                        ))}
                        {otherTeamMembers.length > 0 && (
                          <optgroup label="Otros integrantes del equipo">
                            {otherTeamMembers.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    {directors.length > 0 ? (
                      <p className="text-xs text-muted">
                        Se mostrará como: <strong className="text-ink font-semibold">{formatDirectors(directors)}</strong>
                      </p>
                    ) : (
                      <p className="text-xs text-muted">
                        Selecciona uno o más integrantes del equipo oficial (puedes añadir múltiples con el botón +).
                      </p>
                    )}
                  </div>
                )}
              </Field>
            </div>

            {exists && (
              <p className="mt-4 flex gap-2 rounded-xl bg-accent-soft p-3 text-sm">
                <Info size={18} className="mt-0.5 shrink-0" aria-hidden />
                Ya hay un servicio en esta fecha. Lo estás editando y al guardar se reemplazará.
              </p>
            )}
          </Card>
        )}

        {step === 1 && (
          <Card title="Canciones" hint="En el orden en que se cantan.">
            <ol className="space-y-3">
              {songs.map((s, i) => (
                <li key={s.key} className="grid grid-cols-[1.5rem_1fr] items-start gap-2 sm:flex sm:flex-wrap [&>p]:sm:order-last [&>p]:sm:basis-full [&>p]:sm:ml-8">
                  <span className="mt-2.5 w-6 shrink-0 text-right font-display text-lg font-bold text-brand-blue">{i + 1}</span>
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                    <input
                      list="songs-list"
                      aria-label={`Canción ${i + 1}`}
                      value={s.name}
                      onChange={(e) => onSongName(s.key, e.target.value)}
                      placeholder="Nombre de la canción"
                      className={inputClass}
                    />
                    <input
                      list="artists-list"
                      aria-label={`Artista de la canción ${i + 1}`}
                      value={s.artist}
                      onChange={(e) => updateSong(s.key, { artist: e.target.value })}
                      placeholder="Artista"
                      className={inputClass}
                    />
                  </div>
                  <RepeatHint name={s.name} fecha={fecha} songByKey={catalogs.songByKey} />
                  <div className="col-start-2 flex shrink-0 justify-end">
                    <IconButton icon={ArrowUp} label="Subir" disabled={i === 0} onClick={() => moveSong(i, -1)} className="disabled:opacity-30" />
                    <IconButton icon={ArrowDown} label="Bajar" disabled={i === songs.length - 1} onClick={() => moveSong(i, 1)} className="disabled:opacity-30" />
                    <IconButton icon={Trash2} label="Quitar canción" onClick={() => setSongs((l) => (l.length > 1 ? l.filter((x) => x.key !== s.key) : [blankSong()]))} />
                  </div>
                </li>
              ))}
            </ol>
            {errors.songs && <p className="mt-3 text-sm text-danger">{errors.songs}</p>}
            <Button variant="secondary" icon={Plus} className="mt-4" onClick={() => setSongs((l) => [...l, blankSong()])}>
              Añadir canción
            </Button>
          </Card>
        )}

        {step === 2 && (
          <Card
            title="Músicos y coristas"
            hint="Selecciona quién toca cada instrumento desde el directorio oficial del ministerio. Puedes omitir este paso."
          >
            <ul className="space-y-3">
              {band.map((m, idx) => (
                <li key={m.key} className="flex items-start gap-2">
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                    <select
                      aria-label={`Instrumento del músico ${idx + 1}`}
                      value={m.instrument}
                      onChange={(e) => updateMember(m.key, { instrument: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Selecciona instrumento…</option>
                      {availableInstruments.map((ins) => (
                        <option key={ins} value={ins}>
                          {ins}
                        </option>
                      ))}
                      {m.instrument && !availableInstruments.includes(m.instrument) && (
                        <option value={m.instrument}>{m.instrument}</option>
                      )}
                    </select>

                    <select
                      aria-label={`Integrante del músico ${idx + 1}`}
                      value={m.person}
                      onChange={(e) => updateMember(m.key, { person: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Selecciona integrante oficial…</option>
                      {catalogs.people.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                      {m.person && !catalogs.people.includes(m.person) && (
                        <option value={m.person}>{m.person} (no registrado)</option>
                      )}
                    </select>
                  </div>
                  <IconButton icon={Trash2} label="Quitar músico" onClick={() => setBand((l) => l.filter((x) => x.key !== m.key))} />
                </li>
              ))}
            </ul>
            <Button variant="secondary" icon={Plus} className={band.length ? 'mt-4' : ''} onClick={() => setBand((l) => [...l, blankMember()])}>
              Añadir integrante
            </Button>
          </Card>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Card
              title="Servicio"
              action={<Button variant="ghost" className="-my-1 min-h-9 px-2 text-sm" onClick={() => goTo(0)}>Cambiar</Button>}
            >
              <p className="font-display text-xl font-bold first-letter:uppercase">{longDate(fecha)}</p>
              <p className="text-muted">
                {directors.length > 1 ? 'Dirigen ' : 'Dirige '}
                <strong className="text-ink font-semibold">{formatDirectors(directors) || 'Sin director'}</strong>
              </p>
            </Card>
            <Card
              title={plural(cleanSongs.length, 'canción', 'canciones')}
              action={<Button variant="ghost" className="-my-1 min-h-9 px-2 text-sm" onClick={() => goTo(1)}>Cambiar</Button>}
            >
              <Setlist songs={cleanSongs} />
            </Card>
            <Card
              title={cleanBand.length ? plural(cleanBand.length, 'músico', 'músicos') : 'Músicos'}
              action={<Button variant="ghost" className="-my-1 min-h-9 px-2 text-sm" onClick={() => goTo(2)}>{cleanBand.length ? 'Cambiar' : 'Añadir'}</Button>}
            >
              <Band band={cleanBand} />
            </Card>
            {exists && isAdmin && (
              <Button variant="danger" icon={Trash2} className="w-full" onClick={handleDelete}>
                Eliminar servicio
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-30 flex gap-3 border-t border-line bg-surface/95 px-4 py-2.5 backdrop-blur shadow-sm md:sticky md:inset-x-auto md:bottom-0 md:-mx-8 md:px-8 md:py-3 md:shadow-none">
        {step > 0 && (
          <Button variant="secondary" icon={ArrowLeft} onClick={() => goTo(step - 1)}>
            Atrás
          </Button>
        )}
        {last ? (
          <Button icon={Save} className="flex-1" disabled={saving} onClick={handleSave}>
            {saving ? 'Guardando…' : 'Guardar servicio'}
          </Button>
        ) : (
          <Button className="flex-1" onClick={() => goTo(step + 1)}>
            {step === 2 && !cleanBand.length ? 'Omitir y revisar' : 'Siguiente'}
            <ArrowRight size={18} aria-hidden />
          </Button>
        )}
      </div>

      <datalist id="songs-list">{catalogs.songs.map((s) => <option key={s.name} value={s.name} />)}</datalist>
      <datalist id="artists-list">{catalogs.artists.map((a) => <option key={a} value={a} />)}</datalist>
    </>
  );
}
