import type { ReactNode } from 'react';

export function Loading({ label = 'Loading your local files…' }: { label?: string }) {
  return <div className="crate-state">{label}</div>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="crate-state">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
