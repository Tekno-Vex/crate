/* eslint-disable @typescript-eslint/no-explicit-any */
// `react-dom` resolves here. Lazy, like the React shim.
const D = (): any => {
  const dom = (globalThis as any).Spicetify?.ReactDOM;
  if (!dom) throw new Error('[crate] Spicetify.ReactDOM is not ready yet');
  return dom;
};

export const createPortal: any = (...args: any[]) => D().createPortal(...args);
export const flushSync: any = (...args: any[]) => D().flushSync(...args);

const ReactDOM: any = new Proxy({}, { get: (_t, key) => D()[key as string] });
export default ReactDOM;
