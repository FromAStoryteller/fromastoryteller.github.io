import { defineConfig } from 'vite';
import { localAuthPlugin } from './scripts/fas-local-auth-server.mjs';
export default defineConfig({ plugins: [localAuthPlugin()], server: { host: '0.0.0.0', allowedHosts: ['terminal.local'] } });
