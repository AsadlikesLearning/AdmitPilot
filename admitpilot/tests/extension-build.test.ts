import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../apps/extension/dist');

test('Extension dist directory exists', () => {
  assert.ok(fs.existsSync(distDir), 'apps/extension/dist directory must exist');
});

test('manifest.json exists and all file references resolve to built files', () => {
  const manifestPath = path.resolve(distDir, 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist in dist');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.strictEqual(manifest.manifest_version, 3, 'Must be Manifest V3');

  // Background worker
  const bgScript = path.resolve(distDir, manifest.background.service_worker);
  assert.ok(fs.existsSync(bgScript), `Service worker ${manifest.background.service_worker} must exist in dist`);

  // Content script
  assert.ok(manifest.content_scripts && manifest.content_scripts.length > 0, 'content_scripts must be declared');
  for (const cs of manifest.content_scripts) {
    for (const jsFile of cs.js) {
      const p = path.resolve(distDir, jsFile);
      assert.ok(fs.existsSync(p), `Content script ${jsFile} must exist in dist`);
    }
  }

  // Popup
  if (manifest.action?.default_popup) {
    const popupHtml = path.resolve(distDir, manifest.action.default_popup);
    assert.ok(fs.existsSync(popupHtml), `Popup HTML ${manifest.action.default_popup} must exist in dist`);
  }

  // Side Panel
  if (manifest.side_panel?.default_path) {
    const sidepanelHtml = path.resolve(distDir, manifest.side_panel.default_path);
    assert.ok(fs.existsSync(sidepanelHtml), `Sidepanel HTML ${manifest.side_panel.default_path} must exist in dist`);
  }

  // Icons
  assert.ok(manifest.icons, 'icons must be declared');
  for (const size of ['16', '48', '128']) {
    const iconRel = manifest.icons[size];
    assert.ok(iconRel, `Icon ${size} must be configured in manifest.icons`);
    const iconPath = path.resolve(distDir, iconRel);
    assert.ok(fs.existsSync(iconPath), `Icon file ${iconRel} must exist in dist`);
    assert.ok(fs.statSync(iconPath).size > 0, `Icon file ${iconRel} must not be empty`);
  }
});

test('content.js is a classic script with ZERO ES module import or export statements', () => {
  const contentPath = path.resolve(distDir, 'content.js');
  assert.ok(fs.existsSync(contentPath), 'content.js must exist in dist');

  const contentCode = fs.readFileSync(contentPath, 'utf8');

  // Verify no top-level import statement exists
  const hasImport = /^\s*import\s+/m.test(contentCode);
  assert.strictEqual(
    hasImport,
    false,
    'content.js must NOT contain any static import statement (causes "Cannot use import statement outside a module")'
  );

  // Verify no export statement exists
  const hasExport = /^\s*export\s+/m.test(contentCode);
  assert.strictEqual(
    hasExport,
    false,
    'content.js must NOT contain any export statement in classic content script'
  );

  // Verify content script includes action handlers
  assert.ok(contentCode.includes('SCAN_FORM'), 'content.js must handle SCAN_FORM action');
  assert.ok(contentCode.includes('ANALYZE_PAGE'), 'content.js must handle ANALYZE_PAGE action');
  assert.ok(contentCode.includes('FILL_FORM'), 'content.js must handle FILL_FORM action');
  assert.ok(contentCode.includes('ATTACH_FILES'), 'content.js must handle ATTACH_FILES action');
  assert.ok(contentCode.includes('PING'), 'content.js must handle PING action');
});

test('sidepanel.html references a valid, non-empty compiled CSS stylesheet', () => {
  const sidepanelHtmlPath = path.resolve(distDir, 'sidepanel.html');
  assert.ok(fs.existsSync(sidepanelHtmlPath), 'sidepanel.html must exist in dist');

  const html = fs.readFileSync(sidepanelHtmlPath, 'utf8');
  const cssMatch = html.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/i);
  assert.ok(cssMatch, 'sidepanel.html MUST contain a <link rel="stylesheet"> tag');

  const cssHref = cssMatch[1].replace(/^\//, '');
  const cssPath = path.resolve(distDir, cssHref);
  assert.ok(fs.existsSync(cssPath), `Stylesheet file ${cssHref} must exist in dist`);

  const cssContent = fs.readFileSync(cssPath, 'utf8');
  assert.ok(cssContent.length > 1000, `Stylesheet ${cssHref} must be populated with compiled CSS (got ${cssContent.length} bytes)`);
  assert.ok(cssContent.includes('--tw-') || cssContent.includes('background-color'), 'Stylesheet must contain compiled Tailwind CSS rules');
});

test('popup.html references a valid compiled stylesheet and script', () => {
  const popupHtmlPath = path.resolve(distDir, 'popup.html');
  assert.ok(fs.existsSync(popupHtmlPath), 'popup.html must exist in dist');

  const html = fs.readFileSync(popupHtmlPath, 'utf8');
  assert.ok(html.includes('<link rel="stylesheet"'), 'popup.html must have a stylesheet linked');
  assert.ok(html.includes('<script type="module"'), 'popup.html must have script linked');
});

