declare module '*.css' {
  const css: string;
  export default css;
}

declare module '*.svg' {
  const svg: string;
  export default svg;
}

/** Injected by scripts/build.mjs */
declare const __APP_ID__: string;
declare const __APP_NAME__: string;
declare const __APP_VERSION__: string;
declare const __DEV__: boolean;
