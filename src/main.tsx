import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from '@/contexts/AuthContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);

// Register Service Worker for PWA + Background Sync
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((reg) => {
        // Attempt to register periodic background sync if available
        if ('periodicSync' in reg) {
          (reg as ServiceWorkerRegistration & { periodicSync: { register: (tag: string) => Promise<void> } })
            .periodicSync.register('location-sync')
            .catch(() => {
              // Periodic sync requires installed PWA + permissions — non-fatal
            });
        }
        // Register one-shot background sync for offline location uploads
        if ('sync' in reg) {
          (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } })
            .sync.register('location-sync')
            .catch(() => {
              // Non-fatal — will retry on next online event
            });
        }
      })
      .catch((err) => {
        console.error('Service Worker registration failed:', err);
      });
  });
}
