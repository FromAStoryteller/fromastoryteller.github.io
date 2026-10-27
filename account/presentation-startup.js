// Synchronous first-paint presentation only. Stored credentials never grant access.
// Account services still refresh and verify the session and roles on the server.
(() => {
  const namespaces = {
    'https://fromastoryteller.com': 'vzdicnufhidelaoeqbza-supabase-co',
    'http://127.0.0.1:55410': 'oqmmvjjycpyxvxipcyli-supabase-co',
    'http://127.0.0.1:55400': '127-0-0-1-55321',
  };
  try {
    const namespace = namespaces[location.origin];
    if (!namespace) return;
    const prefix = 'fas-account-' + namespace;
    const tabOnly = sessionStorage.getItem(prefix + '-mode') === 'tab';
    const tabId = sessionStorage.getItem(prefix + '-tab-id');
    if (tabOnly && !/^[0-9a-f-]{36}$/i.test(tabId ?? '')) return;
    const stored = JSON.parse((tabOnly ? sessionStorage : localStorage).getItem(prefix + (tabOnly ? '-' + tabId : '-remembered')) ?? 'null');
    if (!stored?.user?.id || typeof stored.access_token !== 'string' || !stored.access_token) return;
    document.documentElement.dataset.fasAccountStartup = 'pending';
    if (/^\/(?:index\.html)?$/.test(location.pathname)) document.documentElement.dataset.fasHomeStartup = 'pending';
  } catch { /* Blocked storage and malformed hints retain the public page. */ }
})();
