/* eslint-disable no-console */
// The only place that writes to the console. Prefix makes our lines easy to filter in DevTools.
const PREFIX = `[${__APP_ID__}]`;

export const log = {
  debug: (...args: unknown[]) => {
    if (__DEV__) console.debug(PREFIX, ...args);
  },
  info: (...args: unknown[]) => console.info(PREFIX, ...args),
  warn: (...args: unknown[]) => console.warn(PREFIX, ...args),
  error: (...args: unknown[]) => console.error(PREFIX, ...args),
};
