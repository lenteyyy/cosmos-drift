import { useSyncExternalStore } from 'react';
const listeners = new Set<() => void>();
let foreground = !document.hidden;
let channel: BroadcastChannel | null = null;
const id = crypto.randomUUID();
let owner = id;
let cleanup: (() => void) | null = null;
function publish(next: boolean) {
  if (foreground === next) return;
  foreground = next;
  listeners.forEach((listener) => listener());
  window.dispatchEvent(new Event('cosmos-activity'));
}
export function isPageActive() {
  return foreground && !document.hidden;
}
export function claimPage() {
  if (document.hidden) return;
  owner = id;
  channel?.postMessage({ type: 'claim', id });
  publish(true);
}
function install() {
  channel =
    typeof BroadcastChannel === 'undefined'
      ? null
      : new BroadcastChannel('cosmos-drift-render-owner');
  channel?.addEventListener('message', (event) => {
    const message = event.data;
    if (!message || message.id === id) return;
    if (message.type === 'claim') {
      owner = message.id;
      publish(false);
    } else if (
      message.type === 'release' &&
      owner === message.id &&
      !document.hidden &&
      document.hasFocus()
    )
      claimPage();
  });
  const release = () => {
    channel?.postMessage({ type: 'release', id });
    publish(false);
  };
  const visibility = () => {
    if (document.hidden) release();
    else claimPage();
  };
  const interaction = (event: Event) => {
    if (event.isTrusted && !isPageActive()) claimPage();
  };
  window.addEventListener('focus', claimPage);
  window.addEventListener('blur', release);
  window.addEventListener('pagehide', release);
  document.addEventListener('visibilitychange', visibility);
  document.addEventListener('pointerdown', interaction, true);
  document.addEventListener('keydown', interaction, true);
  claimPage();
  return () => {
    release();
    channel?.close();
    channel = null;
    window.removeEventListener('focus', claimPage);
    window.removeEventListener('blur', release);
    window.removeEventListener('pagehide', release);
    document.removeEventListener('visibilitychange', visibility);
    document.removeEventListener('pointerdown', interaction, true);
    document.removeEventListener('keydown', interaction, true);
  };
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!cleanup) cleanup = install();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      cleanup?.();
      cleanup = null;
    }
  };
}
export const usePageActive = () => useSyncExternalStore(subscribe, isPageActive, () => false);
