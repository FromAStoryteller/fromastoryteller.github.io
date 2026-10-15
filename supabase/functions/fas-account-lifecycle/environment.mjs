// Separate exact opt-ins: a DEV flag never enables the production service.
export function lifecycleEnvironment(base, developmentEnabled, productionEnabled) {
  const local = base === 'http://kong:8000';
  const development = base === 'https://oqmmvjjycpyxvxipcyli.supabase.co' && developmentEnabled === 'true';
  const production = base === 'https://vzdicnufhidelaoeqbza.supabase.co' && productionEnabled === 'true';
  return { enabled: local || development || production, origin: production ? 'https://fromastoryteller.com' : development ? 'http://127.0.0.1:55410' : 'http://127.0.0.1:55400' };
}
