/**
 * Window & Embedded Environment Utilities
 * Security Operations Hub (SOH)
 *
 * Detects whether the application is running inside an iframe (like the Google AI Studio
 * preview panel) and provides safe navigation helpers.
 */

export function isEmbeddedInIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    // A cross-origin security exception confirms it is inside an iframe
    return true;
  }
}

export function getStandaloneAppUrl(): string {
  if (typeof window !== 'undefined' && window.location?.href) {
    return window.location.href;
  }
  return import.meta.env.APP_URL || 'https://ais-pre-bl22h7ezigcrswtavdzplh-414301444631.asia-southeast1.run.app';
}
