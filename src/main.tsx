import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import './index.css';

// Prevent uncaught promise rejections from crashing the app runtime or cluttering console
window.addEventListener('unhandledrejection', (event) => {
  console.warn('Handled global promise rejection:', event.reason);
  try { event.preventDefault(); } catch (e) {}
});

window.addEventListener('error', (event) => {
  console.warn('Handled global error event:', event.message);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);


