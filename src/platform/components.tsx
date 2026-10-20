/* eslint-disable @typescript-eslint/no-explicit-any */
// Spotify's own React components (Spicetify.ReactComponent), wrapped so the rest of the app never
// touches them directly and degrades to plain elements when one is missing.
// S7 (1.3.5): RightClickMenu, TrackMenu, ContextMenu, Menu, MenuItem … all exist.

import type { ReactNode } from 'react';
import { log } from '../lib/log';

const RC = (): any => (globalThis as any).Spicetify?.ReactComponent;

let Boundary: any;
/**
 * Error boundary around Spotify's components: a throw inside their menu must not unmount Crate.
 * React only supports boundaries as classes; built lazily so nothing touches Spicetify.React at
 * module evaluation (hard rule 2).
 */
function getBoundary(): any {
  if (Boundary) return Boundary;
  const React = (globalThis as any).Spicetify.React;
  Boundary = class NativeBoundary extends React.Component {
    state = { failed: false };
    static getDerivedStateFromError() {
      return { failed: true };
    }
    componentDidCatch(error: unknown) {
      log.warn('native component crashed; falling back', error);
    }
    render() {
      return this.state.failed ? (this as any).props.fallback ?? null : (this as any).props.children;
    }
  };
  return Boundary;
}

export interface MenuTriggerProps {
  isOpen: boolean;
  onContextMenu?: (e: any) => void;
  ref?: (el: Element | null) => void;
}

/**
 * Right-click a track → Spotify's native track menu (Add to playlist, Add to queue, …, plus items
 * other extensions registered — including our "Go to album (Crate)").
 * UNVERIFIED (spike S7 follow-up): TrackMenu's props on 1.3.5 (`uri`) and its items for local tracks.
 */
export function NativeTrackMenu({ uri, children }: { uri: string; children: (p: MenuTriggerProps) => ReactNode }) {
  const rc = RC();
  if (!rc?.RightClickMenu || !rc?.TrackMenu) return <>{children({ isOpen: false })}</>;
  const B = getBoundary();
  const { RightClickMenu, TrackMenu } = rc;
  return (
    <B fallback={children({ isOpen: false })}>
      <RightClickMenu
        menu={
          <B fallback={null}>
            <TrackMenu uri={uri} />
          </B>
        }
      >
        {(isOpen: boolean, onContextMenu: (e: any) => void, ref: (el: Element | null) => void) =>
          children({ isOpen: !!isOpen, onContextMenu, ref })
        }
      </RightClickMenu>
    </B>
  );
}
