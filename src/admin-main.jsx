import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AdminShell from './admin/AdminShell.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode><AdminShell /></StrictMode>,
);
