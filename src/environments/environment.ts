export const environment = {
  production: true,
  // Supabase is used client-side; these values are meant for public (anon key).
  // Keeping it in the build output avoids needing runtime `window.__SUPABASE_*` injection.
  supabaseUrl: 'https://woqtzbjvrtoqkzcbzlos.supabase.co',
  supabaseAnonKey: 'sb_publishable_ugtpMkc_4ndEzxpoMMw1xg_5wLwYnbJ'
} as const;

