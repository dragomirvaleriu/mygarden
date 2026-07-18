
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n';
import '../index.css';
import { Capacitor } from '@capacitor/core';

// Ensure Service Worker is disabled on native Capacitor
if (Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
    }
  });
}

// Global error handling to catch and display errors that might cause a black screen
window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global JS Error:", message, "at", source, lineno, ":", colno, error);
  const rootElement = document.getElementById('root');
  if (rootElement && rootElement.innerHTML === "") {
    rootElement.innerHTML = `
      <div style="padding: 20px; color: white; background: #0E0F11; min-height: 100vh; font-family: sans-serif;">
        <h1 style="color: #f07d00;">Eroare de încărcare</h1>
        <p>Ne cerem scuze, a apărut o eroare la pornirea aplicației.</p>
        <pre style="background: #18191B; padding: 10px; border-radius: 5px; overflow: auto; font-size: 12px;">${message}</pre>
        <button onclick="window.location.reload()" style="background: #f07d00; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; margin-top: 10px;">Reîncărcați pagina</button>
      </div>
    `;
  }
  return false;
};

window.onunhandledrejection = function(event) {
  console.error("Unhandled Promise Rejection:", event.reason, event);
  const rootElement = document.getElementById('root');
  if (rootElement && rootElement.innerHTML === "") {
    rootElement.innerHTML = `
      <div style="padding: 20px; color: white; background: #0E0F11; min-height: 100vh; font-family: sans-serif;">
        <h1 style="color: #f07d00;">Eroare de încărcare (Promise)</h1>
        <p>Ne cerem scuze, a apărut o eroare la pornirea aplicației.</p>
        <pre style="background: #18191B; padding: 10px; border-radius: 5px; overflow: auto; font-size: 12px;">${event.reason}</pre>
        <button onclick="window.location.reload()" style="background: #f07d00; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; margin-top: 10px;">Reîncărcați pagina</button>
      </div>
    `;
  }
};

console.log("Scapeflow: index.tsx is running...");
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Prevent number input from changing on scroll
document.addEventListener('wheel', function(event) {
  if (document.activeElement && (document.activeElement as HTMLInputElement).type === 'number') {
    event.preventDefault();
  }
}, { passive: false });

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity, // Caches forever during session
      gcTime: Infinity,    // Prevents garbage collection
    },
  },
});

console.log("Scapeflow: Starting root.render...");
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
console.log("Scapeflow: root.render call completed.");
