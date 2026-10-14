import React from 'react';import {createRoot} from 'react-dom/client';
import './styles/global.css';import './styles/landing.css';import './styles/login.css';import './styles/dashboard.css';
import App from './App.jsx';
createRoot(document.getElementById('root')).render(<App/>);
