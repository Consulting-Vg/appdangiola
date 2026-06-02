import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Configuración global de API URL para Render o Localhost
const API_URL = import.meta.env.VITE_API_URL || '';
if (API_URL) {
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    if (typeof input === 'string' && input.startsWith('/api')) {
      if (!input.startsWith('http')) {
        const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
        input = `${baseUrl}${input}`;
      }
    }
    return originalFetch(input, init);
  };
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
