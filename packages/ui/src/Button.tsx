import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import Link from "next/link";

const base: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.4rem",
  padding: "0.55rem 1rem",
  fontWeight: 700,
  fontSize: "0.9rem",
  border: "var(--pylr-rule-width) solid var(--pylr-ink)",
  borderRadius: 0,
  cursor: "pointer",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const variants = {
  primary: {
    background: "var(--pylr-red)",
    color: "var(--pylr-red-ink)",
    borderColor: "var(--pylr-red)",
  },
  secondary: {
    background: "var(--pylr-surface)",
    color: "var(--pylr-ink)",
  },
} as const;

export type ButtonVariant = keyof typeof variants;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

/** A submit/action button — used inside a `<form action={...}>` exactly like a plain `<button>`. */
export function Button({ variant = "secondary", style, ...props }: ButtonProps) {
  return <button {...props} style={{ ...base, ...variants[variant], ...style }} />;
}

interface LinkButtonProps {
  href: string;
  variant?: ButtonVariant;
  children: ReactNode;
}

/** The same visual as Button, for plain navigation (next/link) rather than a form submit. */
export function LinkButton({ href, variant = "secondary", children }: LinkButtonProps) {
  return (
    <Link href={href} style={{ ...base, ...variants[variant] }}>
      {children}
    </Link>
  );
}
