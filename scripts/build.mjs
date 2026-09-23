import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { Script } from 'node:vm';

const root = fileURLToPath(new URL('../dist/', import.meta.url));

// A deliberately small packer for this app's two modules. Reject new module
// syntax instead of silently producing a broken local-file build.
export async function build({ check = false } = {}) {
  const [html, css, state, app, diagnostics] = await Promise.all(
    ['index.html', 'styles.css', 'state.js', 'app.js', 'load-check.js'].map(file => readFile(path.join(root, file), 'utf8'))
  );
  const importPattern = /^import \{ ([\w, ]+) \} from '\.\/state\.js';\r?\n/;
  const imports = app.match(importPattern);
  if (!imports) throw new Error('app.js must explicitly import its state helpers from ./state.js');
  const exports = new Set([...state.matchAll(/^export (?:const|function) (\w+)/gm)].map(match => match[1]));
  for (const name of imports[1].split(',').map(value => value.trim())) {
    if (!exports.has(name)) throw new Error(`Missing state export: ${name}`);
  }
  const code = state.replace(/^export (?=(?:const|function) )/gm, '') + '\n' + app.replace(importPattern, '');
  if (/^\s*(?:import|export)\s/m.test(code)) throw new Error('Unsupported module syntax: update the packer before adding modules.');
  const bundle = `(function () {\n'use strict';\n${code}\nwindow.helenLoadCheck.ready();\n})();`;
  new Script(bundle, { filename: 'app-bundle.js' });
  new Script(diagnostics, { filename: 'load-check.js' });
  if (/<\/script/i.test(bundle + diagnostics) || /<\/style/i.test(css)) throw new Error('Unsafe inline closing tag in source');
  let output = html;
  const sections = {
    INLINE_STYLES: `<style id="app-styles">\n${css.replace(/^@charset\s+"UTF-8";\s*/i, '')}\n</style>`,
    LOAD_CHECK: `<script id="load-check">\n${diagnostics}\n</script>`,
    APP_BUNDLE: `<script id="app-bundle">\n${bundle}\n</script>`,
  };
  for (const [name, content] of Object.entries(sections)) {
    const pattern = new RegExp(`<!-- BEGIN:${name} -->[\\s\\S]*?<!-- END:${name} -->`, 'g');
    if ([...output.matchAll(pattern)].length !== 1) throw new Error(`Expected exactly one ${name} region in index.html`);
    output = output.replace(pattern, () => `<!-- BEGIN:${name} -->\n${content}\n  <!-- END:${name} -->`);
  }
  if (check && output !== html) throw new Error('index.html is out of date. Run npm run build.');
  if (!check && output !== html) {
    const temporary = path.join(root, '.index.build.tmp');
    await writeFile(temporary, output, 'utf8');
    await rename(temporary, path.join(root, 'index.html'));
  }
  return Buffer.byteLength(output);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const bytes = await build({ check: process.argv.includes('--check') });
  console.log(`Self-contained index.html verified (${bytes} bytes); original CSS and game logic preserved.`);
}
