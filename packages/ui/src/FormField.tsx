import type { CSSProperties, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const fieldStyle: CSSProperties = {
  display: "block",
  width: "100%",
  padding: "0.5rem 0.6rem",
  border: "var(--pylr-rule-width) solid var(--pylr-rule)",
  borderRadius: 0,
  background: "var(--pylr-surface)",
  marginTop: "var(--pylr-space-1)",
};

/** Label + form control, spaced consistently. Wrap a TextInput/Select/Textarea (or any native control) in this. */
export function FormField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600 }}>
      {label}
      {children}
      {hint && (
        <span style={{ display: "block", fontWeight: 400, fontSize: "0.75rem", color: "var(--pylr-ink-muted)", marginTop: "0.2rem" }}>
          {hint}
        </span>
      )}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...fieldStyle, ...props.style }} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...fieldStyle, ...props.style }} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...fieldStyle, ...props.style }} />;
}
