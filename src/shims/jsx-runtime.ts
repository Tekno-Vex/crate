/* eslint-disable @typescript-eslint/no-explicit-any */
// Automatic JSX runtime over Spicetify.React (esbuild jsx: "automatic" imports this).
import { Fragment as FragmentSentinel, createElement } from './react';

export const Fragment = FragmentSentinel;

function split(props: any, key: any) {
  const { children, ...rest } = props ?? {};
  if (key !== undefined) rest.key = key;
  return { children, rest };
}

/** Single child (or none). */
export function jsx(type: any, props: any, key?: any) {
  const { children, rest } = split(props, key);
  return children === undefined ? createElement(type, rest) : createElement(type, rest, children);
}

/** Static children array — spread so React doesn't demand keys. */
export function jsxs(type: any, props: any, key?: any) {
  const { children, rest } = split(props, key);
  return Array.isArray(children)
    ? createElement(type, rest, ...children)
    : createElement(type, rest, children);
}

export const jsxDEV = jsx;
