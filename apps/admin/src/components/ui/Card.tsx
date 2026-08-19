import type { ReactNode } from "react";

export type CardProps = {
  children: ReactNode;
  /** Elevation step — omit for a flat surface-filled card. */
  elevation?: "sm" | "md" | "lg";
  className?: string;
};

/** Modernist `.card` — a flush-left, zero-radius, surface-filled container. */
export function Card({ children, elevation, className }: CardProps) {
  const classes = ["card", elevation && `elev-${elevation}`, className].filter(Boolean).join(" ");
  return <div className={classes}>{children}</div>;
}

Card.Kicker = function CardKicker({ children }: { children: ReactNode }) {
  return <div className="card-kicker">{children}</div>;
};

Card.Title = function CardTitle({ children }: { children: ReactNode }) {
  return <div className="card-title">{children}</div>;
};

Card.Body = function CardBody({ children }: { children: ReactNode }) {
  return <p className="card-body">{children}</p>;
};

Card.Meta = function CardMeta({ children }: { children: ReactNode }) {
  return <div className="card-meta">{children}</div>;
};
