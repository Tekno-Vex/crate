/* eslint-disable @typescript-eslint/no-explicit-any */
// `import ... from "react"` resolves here at bundle time (see scripts/build.mjs).
// Everything resolves Spicetify.React LAZILY, so modules can be evaluated before Spicetify is
// ready (the extension loads early). Never read Spicetify.React at module top level.

const R = (): any => {
  const react = (globalThis as any).Spicetify?.React;
  if (!react) throw new Error('[crate] Spicetify.React is not ready yet');
  return react;
};

/** Sentinel so `Fragment` can be exported before React exists; swapped in createElement. */
export const FRAGMENT_SENTINEL = Symbol.for('crate.react.fragment');
export const Fragment: any = FRAGMENT_SENTINEL;

export const resolveType = (type: any) => (type === FRAGMENT_SENTINEL ? R().Fragment : type);

export const createElement = (type: any, props?: any, ...children: any[]) =>
  R().createElement(resolveType(type), props, ...children);

const lazy =
  (name: string) =>
  (...args: any[]) =>
    R()[name](...args);

export const useState: any = lazy('useState');
export const useEffect: any = lazy('useEffect');
export const useLayoutEffect: any = lazy('useLayoutEffect');
export const useMemo: any = lazy('useMemo');
export const useCallback: any = lazy('useCallback');
export const useRef: any = lazy('useRef');
export const useReducer: any = lazy('useReducer');
export const useContext: any = lazy('useContext');
export const useId: any = lazy('useId');
export const useTransition: any = lazy('useTransition');
export const useDeferredValue: any = lazy('useDeferredValue');
export const useSyncExternalStore: any = lazy('useSyncExternalStore');
export const useImperativeHandle: any = lazy('useImperativeHandle');
export const createContext: any = lazy('createContext');
export const memo: any = lazy('memo');
export const forwardRef: any = lazy('forwardRef');
export const cloneElement: any = lazy('cloneElement');
export const isValidElement: any = lazy('isValidElement');
export const startTransition: any = lazy('startTransition');

const React: any = new Proxy(
  {},
  {
    get(_t, key) {
      if (key === 'Fragment') return FRAGMENT_SENTINEL;
      if (key === 'createElement') return createElement;
      return R()[key as string];
    },
  },
);

export default React;
