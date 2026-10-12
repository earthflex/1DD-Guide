// Vercel build step: write config.js from public env vars. Keeps the committed config.js when vars are missing.
const fs = require('fs');
// Local runs: load .env.local / .env without overriding real env vars.
for (const file of ['.env.local', '.env']) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
if (!url || !key || url.includes('YOUR-PROJECT') || key.includes('YOUR-KEY')) { console.log('Supabase env vars not set; keeping config.js'); process.exit(0); }
if (key.startsWith('sb_secret_')) { console.error('Refusing to publish a secret key'); process.exit(1); }
fs.writeFileSync('config.js', '// Generated at build from Vercel env vars. Public keys only.\nwindow.GUIDE_CONFIG = ' + JSON.stringify({ supabaseUrl: url, supabaseKey: key }, null, 2) + ';\n');
console.log('config.js written for ' + url);
