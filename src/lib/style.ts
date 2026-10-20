import css from '../styles/app.css';

/** Inject our stylesheet once. Safe to call from both the app and the extension. */
export function ensureStyles(): void {
  const id = `${__APP_ID__}-styles`;
  if (document.getElementById(id)) return;
  const el = document.createElement('style');
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}
