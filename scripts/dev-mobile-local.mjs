// Starts Expo against the local Supabase stack (`supabase start`), no .env file needed.
//   pnpm dev:mobile:local            → web/simulator on this machine (127.0.0.1)
//   pnpm dev:mobile:local --lan      → phone on the same Wi-Fi (uses this PC's LAN IP)
// Any other arguments are passed to `expo start` (e.g. --web --port 8081).
import { execFileSync, spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';

const args = process.argv.slice(2);
const lan = args.includes('--lan');
const expoArgs = args.filter((a) => a !== '--lan');

const status = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'env'], {
  encoding: 'utf8',
  shell: true,
  stdio: ['ignore', 'pipe', 'ignore'],
});
const vars = Object.fromEntries(
  status
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
if (!vars.API_URL || !vars.ANON_KEY) {
  console.error(
    'Local Supabase is not running. Start Docker Desktop, then: pnpm exec supabase start',
  );
  process.exit(1);
}

let apiUrl = vars.API_URL;
if (lan) {
  // Windows'ta ilk adres çoğu zaman Hyper-V/WSL sanal adaptörü (vEthernet, 172.x) olur;
  // telefon ona ulaşamaz. Sanal adaptörleri atla, ev ağı aralığını (192.168/10) öne al.
  const candidates = Object.entries(networkInterfaces())
    .filter(([name]) => !/vEthernet|WSL|VirtualBox|VMware|Docker/i.test(name))
    .flatMap(([, list]) => list ?? [])
    .filter((i) => i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
  const ip =
    candidates.find((a) => a.startsWith('192.168.') || a.startsWith('10.')) ?? candidates[0];
  if (!ip) {
    console.error('No LAN IPv4 address found.');
    process.exit(1);
  }
  apiUrl = apiUrl.replace('127.0.0.1', ip);
}
console.log(`Supabase: ${apiUrl}`);

const child = spawn('pnpm', ['--filter', 'mobile', 'exec', 'expo', 'start', ...expoArgs], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    EXPO_PUBLIC_SUPABASE_URL: apiUrl,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: vars.ANON_KEY,
  },
});
child.on('exit', (code) => process.exit(code ?? 0));
