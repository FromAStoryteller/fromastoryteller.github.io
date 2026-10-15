// Exact allowlist and explicit opt-in: production remains disabled.
export function lifecycleEnvironment(base, developmentEnabled) {
  const local = base === 'http://kong:8000';
  const development = base === 'https://oqmmvjjycpyxvxipcyli.supabase.co' && developmentEnabled === 'true';
  return { enabled: local || development, origin: development ? 'http://127.0.0.1:55410' : 'http://127.0.0.1:55400' };
}
