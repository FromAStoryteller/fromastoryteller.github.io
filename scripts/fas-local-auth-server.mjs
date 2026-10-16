import { isLocalAuthConfig, isDevAuthConfig, DEV_AUTH_URL } from '../account/auth-settings.mjs';

export function localAuthPlugin(env = process.env) {
  const development = env.FAS_DEV_AUTH_ENABLED === 'true';
  const config = development
    ? { mode: 'development', url: DEV_AUTH_URL, key: env.FAS_DEV_PUBLIC_KEY, signup: env.FAS_DEV_SIGNUP_ENABLED === 'true', lifecycle: env.FAS_DEV_LIFECYCLE_ENABLED === 'true' }
    : { url: 'http://127.0.0.1:55321', key: env.FAS_LOCAL_ANON_KEY, signup: env.FAS_LOCAL_SIGNUP_ENABLED === 'true', lifecycle: env.FAS_LOCAL_LIFECYCLE_ENABLED === 'true' };
  return {
    name: 'fas-local-auth-only',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/__fas/local-auth') return next();
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (req.method !== 'GET' || req.headers.host !== (development ? '127.0.0.1:55410' : '127.0.0.1:55400') ||
            (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin') ||
            (development ? !isDevAuthConfig(config) : env.FAS_LOCAL_AUTH_ENABLED !== 'true' || !isLocalAuthConfig(config))) {
          res.statusCode = 404;
          return res.end();
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(config));
      });
    },
  };
}
