import { useEffect, useId } from 'react';
import { X } from 'lucide-react';

export const cx = (...c) => c.filter(Boolean).join(' ');

const BUTTON = {
  primary: 'bg-accent text-accent-ink hover:brightness-105 active:brightness-95',
  secondary: 'bg-surface text-ink border border-line hover:bg-sunken',
  ghost: 'text-muted hover:bg-sunken hover:text-ink',
  danger: 'text-danger border border-danger/40 hover:bg-danger/10',
};

export function Button({ variant = 'primary', icon: Icon, children, className, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold',
        'transition disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON[variant],
        className,
      )}
    >
      {Icon && <Icon size={18} aria-hidden />}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, className, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cx(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-sunken hover:text-ink',
        className,
      )}
    >
      <Icon size={20} aria-hidden />
    </button>
  );
}

export function Field({ label, hint, error, className, children, ...props }) {
  const id = useId();
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
          {label}
        </label>
      )}
      {children ? (
        children(id)
      ) : (
        <input
          id={id}
          {...props}
          className={cx(
            'min-h-11 w-full rounded-xl border bg-surface px-3.5 text-base placeholder:text-muted/70',
            error ? 'border-danger' : 'border-line',
          )}
        />
      )}
      {error ? (
        <p className="mt-1.5 text-sm text-danger">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-sm text-muted">{hint}</p>
      )}
    </div>
  );
}

export const inputClass =
  'min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-base placeholder:text-muted/70';

export function Chip({ active, children, className, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...props}
      className={cx(
        'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition',
        active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink hover:bg-sunken',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Sheet({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px] [animation:fade-in_.2s_ease-out]" onClick={onClose} />
      <div className="relative flex max-h-[88dvh] w-full flex-col rounded-t-3xl bg-surface shadow-2xl [animation:sheet-in_.22s_ease-out] sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-2">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <IconButton icon={X} label="Cerrar" onClick={onClose} className="-mr-2" />
        </div>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="flex gap-3 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/** `tone="danger"` (por defecto) para acciones destructivas; `tone="primary"` para las que no lo son. */
export function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel, tone = 'danger' }) {
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={onCancel}>Cancelar</Button>
          <Button className={cx('flex-1', tone === 'danger' && '!bg-danger !text-white')} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="text-muted">{message}</p>
    </Sheet>
  );
}

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-line px-6 py-12 text-center">
      {Icon && (
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-ink">
          <Icon size={26} aria-hidden />
        </div>
      )}
      <h3 className="font-display text-xl font-bold">{title}</h3>
      {children && <p className="mt-1.5 max-w-sm text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cx('animate-pulse rounded-2xl bg-sunken', className)} />;
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    // En móvil la barra inferior ya dice dónde estás: el título solo se muestra desde md.
    <header className="mb-6 hidden items-start justify-between gap-4 md:flex">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted sm:text-base">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}
