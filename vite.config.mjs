import {fileURLToPath} from 'node:url';
import {communityRoutePlugin} from './scripts/community-route-plugin.mjs';
import { defineConfig } from 'vite';
import { localAuthPlugin } from './scripts/fas-local-auth-server.mjs';
export default defineConfig({ plugins: [communityRoutePlugin(fileURLToPath(new URL('.',import.meta.url))),localAuthPlugin()], server: { host: '0.0.0.0', allowedHosts: ['terminal.local'] } });
