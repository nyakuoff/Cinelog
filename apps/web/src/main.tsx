import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './lib/auth';
import { queryClient } from './lib/queryClient';

// Self-hosted type. Bundled and served by the app itself — a self-hosted
// instance may have no outbound internet, where a CDN font would just fail
// to load and silently drop the interface back to system fallbacks.
// Archivo carries both axes (weight + width); the width axis is what makes
// `.font-cond` a genuine condensed cut rather than merely bold.
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/courier-prime/400.css';
import '@fontsource/courier-prime/700.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);

// Register the PWA service worker in production only (keeps the Vite dev server's
// HMR untouched). Served from the app root, so its scope is "/".
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      /* best-effort; the app works fine without it */
    });
  });
}
