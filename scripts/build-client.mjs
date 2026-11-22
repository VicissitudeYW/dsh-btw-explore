import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');
const output = `window.__ModuleLoader__.load({
  id: 'dsh-btw-explore',
  factory: (require) => {
    const React = require('react');
    const h = React.createElement;
    const EXPLORE_CSS = ${JSON.stringify(['src/explore.css', 'src/chrome.css', 'src/navigation.css', 'src/motion.css'].map(read).join('\n'))};
    ${read('src/view.js')}
    ${read('src/navigation.js')}
    ${read('src/drag.js')}
    ${read('src/pages.js')}
    ${read('src/native.js')}
    ${read('src/entry.js')}
  }
});\n`;
new Script(output, { filename: 'dsh-btw-explore/lib/client.js' });
mkdirSync(new URL('lib/', root), { recursive: true });
writeFileSync(new URL('lib/client.js', root), output, 'utf8');
console.log(`Built ${fileURLToPath(new URL('lib/client.js', root))} (${output.length} chars)`);
