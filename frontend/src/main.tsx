import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import './i18n';
import { AppThemeProvider } from './theme/ThemeProvider';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppThemeProvider>
      <App />
    </AppThemeProvider>
  </React.StrictMode>,
);
