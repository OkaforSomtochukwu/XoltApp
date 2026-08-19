"use client";

import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

/** Modernist `.field` + `.input`. */
export function Input({ label, id, className, ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="field">
      {label && <label htmlFor={inputId}>{label}</label>}
      <input id={inputId} className={["input", className].filter(Boolean).join(" ")} {...rest} />
    </div>
  );
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
};

/** Modernist `.field` + `textarea.input`. */
export function Textarea({ label, id, className, rows = 3, ...rest }: TextareaProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="field">
      {label && <label htmlFor={inputId}>{label}</label>}
      <textarea
        id={inputId}
        rows={rows}
        className={["input", className].filter(Boolean).join(" ")}
        {...rest}
      />
    </div>
  );
}
