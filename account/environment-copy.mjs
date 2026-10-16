// Only called after the account client has validated its configuration/origin.
export function accountEnvironmentNote(mode, local, development, production = '') {
  return mode === 'production' ? production : mode === 'development' ? development : local;
}
