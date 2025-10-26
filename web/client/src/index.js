import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './i18n'; // Initialize i18n
import './styles/global.css';
import './styles/video.css';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);