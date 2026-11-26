import { build as viteBuild } from 'vite';
import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, 'dist');

async function buildExtension() {
  console.log('🚀 [1/4] Building UI pages (popup.html, sidepanel.html) with Vite & Tailwind...');
  await viteBuild({
    configFile: path.resolve(__dirname, 'vite.config.ts'),
  });

  console.log('📦 [2/4] Bundling content script, background worker, and page funcs as classic IIFEs...');
  
  // 1. Content script (Must be a classic self-contained script without top-level import/export)
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, 'src/content/index.ts')],
    bundle: true,
    format: 'iife',
    target: ['chrome100'],
    outfile: path.resolve(distDir, 'content.js'),
    sourcemap: false,
    minify: false,
  });

  // 2. Background service worker
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, 'src/background/index.ts')],
    bundle: true,
    format: 'iife',
    target: ['chrome100'],
    outfile: path.resolve(distDir, 'background.js'),
    sourcemap: false,
    minify: false,
  });

  // 3. Main world page functions
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, 'src/injected/page-funcs.ts')],
    bundle: true,
    format: 'iife',
    target: ['chrome100'],
    outfile: path.resolve(distDir, 'page-funcs.js'),
    sourcemap: false,
    minify: false,
  });

  console.log('📋 [3/4] Copying manifest.json and icons to dist...');
  const manifestSrc = fs.existsSync(path.resolve(__dirname, 'manifest.json'))
    ? path.resolve(__dirname, 'manifest.json')
    : path.resolve(__dirname, 'public/manifest.json');
  fs.copyFileSync(manifestSrc, path.resolve(distDir, 'manifest.json'));

  const iconsSrcDir = fs.existsSync(path.resolve(__dirname, 'icons'))
    ? path.resolve(__dirname, 'icons')
    : path.resolve(__dirname, 'public/icons');
  const iconsDistDir = path.resolve(distDir, 'icons');
  if (!fs.existsSync(iconsDistDir)) {
    fs.mkdirSync(iconsDistDir, { recursive: true });
  }

  for (const iconFile of ['icon16.png', 'icon48.png', 'icon128.png']) {
    const src = path.resolve(iconsSrcDir, iconFile);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.resolve(iconsDistDir, iconFile));
    }
  }

  console.log('🔍 [4/4] Running build verification assertions...');
  validateBuild(distDir);
  console.log('✅ Extension build and packaging validation succeeded!');
}

function validateBuild(dist) {
  // Check manifest
  const manifestPath = path.resolve(dist, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('BUILD FAILED: manifest.json is missing in dist directory.');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Check content script
  const contentPath = path.resolve(dist, 'content.js');
  if (!fs.existsSync(contentPath)) {
    throw new Error('BUILD FAILED: content.js is missing in dist directory.');
  }
  const contentCode = fs.readFileSync(contentPath, 'utf8');
  if (/^\s*import\s+/m.test(contentCode)) {
    throw new Error('BUILD FAILED: content.js contains forbidden static ES module import statement!');
  }
  if (/^\s*export\s+/m.test(contentCode)) {
    throw new Error('BUILD FAILED: content.js contains forbidden export statement!');
  }

  // Check sidepanel HTML and CSS
  const sidepanelHtmlPath = path.resolve(dist, 'sidepanel.html');
  if (!fs.existsSync(sidepanelHtmlPath)) {
    throw new Error('BUILD FAILED: sidepanel.html is missing in dist directory.');
  }
  const sidepanelHtml = fs.readFileSync(sidepanelHtmlPath, 'utf8');
  const cssMatch = sidepanelHtml.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/i);
  if (!cssMatch) {
    throw new Error('BUILD FAILED: sidepanel.html is missing stylesheet reference! Unstyled UI detected.');
  }
  const cssHref = cssMatch[1].replace(/^\//, '');
  const cssFilePath = path.resolve(dist, cssHref);
  if (!fs.existsSync(cssFilePath) || fs.statSync(cssFilePath).size === 0) {
    throw new Error(`BUILD FAILED: Stylesheet referenced by sidepanel.html does not exist or is empty: ${cssHref}`);
  }

  // Check background script
  const bgPath = path.resolve(dist, 'background.js');
  if (!fs.existsSync(bgPath)) {
    throw new Error('BUILD FAILED: background.js is missing in dist directory.');
  }

  // Check icons
  for (const iconSize of ['16', '48', '128']) {
    const iconPath = path.resolve(dist, `icons/icon${iconSize}.png`);
    if (!fs.existsSync(iconPath)) {
      throw new Error(`BUILD FAILED: Icon icon${iconSize}.png is missing in dist/icons!`);
    }
  }
}

buildExtension().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});

