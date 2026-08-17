"use client";

import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

type FormSectionProps = {
  title: string;
  children: ReactNode;
};

export function FormSection({ title, children }: FormSectionProps) {
  return (
    <section className="inv-form-section">
      <h3 className="inv-form-section__title">{title}</h3>
      <div className="inv-form-grid">{children}</div>
    </section>
  );
}

type FormFieldProps = {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>;
};

export function FormField({
  id,
  label,
  required,
  error,
  hint,
  className = "",
  children,
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-invalid": Boolean(error) || undefined,
        "aria-describedby": describedBy,
      })
    : children;

  return (
    <div className={`inv-field ${className}`.trim()}>
      <label htmlFor={id} className="inv-field__label">
        {label}
        {required ? <span className="inv-field__req">*</span> : null}
      </label>
      {control}
      {hint ? (
        <p id={hintId} className="inv-field__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="inv-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function fieldControlClass(error?: string, extra = "") {
  return `field-control${error ? " field-control--error" : ""} ${extra}`.trim();
}
