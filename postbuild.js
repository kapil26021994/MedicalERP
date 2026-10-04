import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.resolve(__dirname, 'dist');
const browserDir = path.resolve(distDir, 'browser');

console.log('Running postbuild artifact setup...');

if (!fs.existsSync(distDir)) {
  console.error('Error: dist directory does not exist!');
  process.exit(1);
}

// 1. If browser output exists, copy all files from dist/browser into dist/
if (fs.existsSync(browserDir)) {
  const browserFiles = fs.readdirSync(browserDir);
  for (const file of browserFiles) {
    const src = path.join(browserDir, file);
    const dest = path.join(distDir, file);
    if (fs.statSync(src).isDirectory()) {
      fs.cpSync(src, dest, { recursive: true });
    } else {
      fs.copyFileSync(src, dest);
    }
  }

  // 2. Ensure index.html exists in dist/ and dist/browser/
  const candidateHtmlFiles = [
    path.join(distDir, 'index.csr.html'),
    path.join(browserDir, 'index.csr.html'),
    path.join(distDir, 'server', 'index.server.html'),
    path.join(__dirname, 'index.html')
  ];

  let htmlSource = null;
  for (const candidate of candidateHtmlFiles) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).size > 0) {
      htmlSource = candidate;
      break;
    }
  }

  if (htmlSource) {
    const rootIndex = path.join(distDir, 'index.html');
    const browserIndex = path.join(browserDir, 'index.html');

    fs.copyFileSync(htmlSource, rootIndex);
    fs.copyFileSync(htmlSource, browserIndex);
    console.log(`Successfully generated index.html from ${path.basename(htmlSource)}`);
  }
}

// 3. Validation: Verify dist/index.html exists and is populated
const finalIndex = path.join(distDir, 'index.html');
if (!fs.existsSync(finalIndex) || fs.statSync(finalIndex).size === 0) {
  console.error('Error: dist/index.html could not be produced!');
  process.exit(1);
}

console.log('Postbuild verified: static artifacts present in dist/ with size', fs.statSync(finalIndex).size, 'bytes.');
