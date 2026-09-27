import { createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import App from './src/App.jsx';
import './src/styles.css';

const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID?.trim();
const serverLocation = import.meta.env.VITE_ELEVENLABS_SERVER_LOCATION?.trim();
const app = createElement(App, { hasLiveAgent: Boolean(agentId) });
const root = createRoot(document.getElementById('root'));

function render(content) {
  root.render(createElement(StrictMode, null, content));
}

if (agentId) {
  import('@elevenlabs/react').then(({ ConversationProvider }) => {
    render(
      createElement(
        ConversationProvider,
        { agentId, ...(serverLocation ? { serverLocation } : {}) },
        app,
      ),
    );
  }).catch(() => render(createElement(App, { hasLiveAgent: false })));
} else {
  render(app);
}
