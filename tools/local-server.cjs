const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = fs.realpathSync(path.resolve(__dirname, '..'));
const host = '127.0.0.1';
const port = 5252;
const url = `http://${host}:${port}/index.html`;
const identity = require('node:crypto').createHash('sha256').update(root).digest('hex');
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.ogg': 'audio/ogg',
};

function openBrowser() {
  if (!process.argv.includes('--open')) return;
  const command = process.platform === 'win32' ? 'powershell.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['-NoProfile', '-NonInteractive', '-Command', `Start-Process '${url}'`] : [url];
  const child = spawn(command, args, { windowsHide: true, stdio: 'ignore' });
  child.on('error', () => console.log(`Open ${url} in your browser.`));
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  if (req.url === '/__52_local_server') { res.end(identity); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, url).pathname); }
  catch { res.writeHead(400).end(); return; }
  if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(part => part.startsWith('.'))) {
    res.writeHead(403).end(); return;
  }
  const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  const mime = types[path.extname(file).toLowerCase()];
  if (!file.startsWith(root + path.sep) || !mime) { res.writeHead(403).end(); return; }
  try {
    const actual = await fs.promises.realpath(file);
    if (!actual.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const stat = await fs.promises.stat(actual);
    if (!stat.isFile()) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', stat.size);
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = fs.createReadStream(actual);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  } catch { res.writeHead(404).end(); }
});

server.on('error', async error => {
  if (error.code === 'EADDRINUSE') {
    try {
      const response = await fetch(`http://${host}:${port}/__52_local_server`, { signal: AbortSignal.timeout(1500) });
      if (response.ok && await response.text() === identity) { openBrowser(); return; }
    } catch {}
    console.error(`Port ${port} is occupied by another app. Close it and run Play 52.cmd again.`);
  } else { console.error(error.message); }
  process.exitCode = 1;
});
server.listen(port, host, () => {
  console.log(`52! is available at ${url}`);
  console.log('Keep this window open while playing. Close it to stop the local server.');
  openBrowser();
});
