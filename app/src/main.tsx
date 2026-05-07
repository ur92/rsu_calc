import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

const dark = localStorage.getItem('rsu-dark') === '1';
document.documentElement.classList.toggle('dark', dark);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
