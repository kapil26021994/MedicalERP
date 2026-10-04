import fs from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const candidates = [
  path.join(__dirname, 'dist', 'server', 'server.mjs'),
  path.join(__dirname, 'dist', 'server.mjs'),
  path.join(__dirname, 'dist', 'server', 'main.server.mjs')
];

let started = false;
for (const cand of candidates) {
  if (fs.existsSync(cand)) {
    const serverModule = await import(`file://${cand}`);
    const requestHandler = serverModule.reqHandler || serverModule.default;
    const port = Number(process.env['PORT'] || 3000);

    createServer(requestHandler).listen(port, () => {
      console.log(`Node Express server listening on http://localhost:${port}`);
    });
    started = true;
    break;
  }
}

if (!started) {
  console.log('Server wrapper ready.');
}
