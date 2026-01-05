import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const platform = (() => {
  const p = (navigator.platform || '').toLowerCase();
  if (p.includes('mac')) return 'darwin';
  if (p.includes('win')) return 'win32';
  return 'linux';
})();

document.documentElement.dataset.platform = platform;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
