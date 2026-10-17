import {communityRoutePlugin} from './community-route-plugin.mjs';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { localAuthPlugin } from './fas-local-auth-server.mjs';
import { readFileSync } from 'node:fs';
const root = fileURLToPath(new URL('../',import.meta.url));
const dev = process.argv.includes('--dev');
let env = {};
if (dev) {
  const config=JSON.parse(readFileSync(new URL('../.preview-dev-config.json',import.meta.url),'utf8'));
  env={FAS_DEV_AUTH_ENABLED:'true',FAS_DEV_PUBLIC_KEY:config.key,FAS_DEV_SIGNUP_ENABLED:'true',FAS_DEV_LIFECYCLE_ENABLED:'true'};
}
const server = await createServer({ configFile:false, root, cacheDir: fileURLToPath(new URL('../.preview-cache/',import.meta.url)), plugins:[communityRoutePlugin(root),localAuthPlugin(env)], server:{host:'127.0.0.1',port:dev?55410:55420,strictPort:true} });
await server.listen();server.printUrls();
