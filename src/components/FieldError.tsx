import type { ReactNode } from 'react';

/* The error pattern every form uses (A11Y-13): an icon and "Error:" as well as the red text,
   and an icon inside the invalid field, so errors don't rely on colour (1.4.1, 3.3.1). */

/** An exclamation in a circle, in the Design System's icon style: 24px grid, 1.8 stroke, round caps. */
export function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5v.01" />
    </svg>
  );
}

/** A field's error message. The field points `aria-describedby` at `id`, so it reads "Error: …". */
export function FieldError({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <p id={id} className={className ? `form-error ${className}` : 'form-error'}>
      <ErrorIcon className="form-error__icon" />
      <span>
        <span className="form-error__label">Error:</span> {children}
      </span>
    </p>
  );
}

/** Wraps a field so an invalid one shows the error icon inside its right end, focused or not. */
export function FieldControl({ invalid, className, children }: { invalid: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={className ? `form-control ${className}` : 'form-control'}>
      {children}
      {invalid && <ErrorIcon className="form-control__icon" />}
    </div>
  );
}
