import { isProductionAuthConfig, PRODUCTION_AUTH_URL } from '../account/auth-settings.mjs';
import { publishedAgreement } from './fas-policy-history.mjs';

// Pure preparation helper. Never retrieves keys, changes Auth or deploys.
export function productionAccountBuildConfig(env, registry, productionBuild) {
  if (env.FAS_PRODUCTION_ACCOUNTS_ENABLED !== 'true') return null;
  // Workers can inherit production build variables for a branch preview. Keep
  // that artifact disconnected even when it uses the production output folder.
  if ((env.WORKERS_CI_BRANCH && env.WORKERS_CI_BRANCH !== 'main') || env.GITHUB_EVENT_NAME === 'pull_request') return null;
  if (!productionBuild) throw new Error('Production accounts cannot be included in a branch preview build.');
  if (env.FAS_PRODUCTION_LIFECYCLE_ENABLED !== 'true') throw new Error('Production lifecycle readiness must be explicitly enabled.');
  const release = publishedAgreement(registry);
  for (const kind of ['terms', 'privacy']) {
    if (release.documents[kind].path !== `/account/policy-history/${registry.activePublishedVersion}/${kind}/index.html`) throw new Error('Production accounts require exact frozen policy snapshot paths.');
  }
  const config = {
    mode: 'production', enabled: true, url: PRODUCTION_AUTH_URL,
    key: env.FAS_PRODUCTION_PUBLIC_KEY, signup: true, lifecycle: true,
    policyRelease: registry.activePublishedVersion,
  };
  if (!isProductionAuthConfig(config)) throw new Error('A valid nonprivileged production public key and policy release are required.');
  return config;
}
