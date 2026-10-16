import { build } from 'vite';
import { fileURLToPath } from 'node:url';

await build({
  configFile: false,
  root: fileURLToPath(new URL('../', import.meta.url)),
  logLevel: 'warn',
  build: {
    outDir: 'account/vendor', emptyOutDir: false, minify: true,
    license: { fileName: 'supabase-license.md' },
    lib: { entry: 'scripts/fas-auth-client-entry.mjs', formats: ['es'], fileName: () => 'supabase-client.js' },
  },
});
console.log('Prepared the pinned, self-hosted Supabase browser client.');
