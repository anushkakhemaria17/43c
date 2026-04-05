import { readFileSync } from 'fs';
import * as acorn from './node_modules/acorn/dist/acorn.js';

const src = readFileSync('./src/pages/AdminDashboard.jsx', 'utf8');
try {
  acorn.parse(src, { ecmaVersion: 2020, sourceType: 'module' });
  console.log('Syntax OK');
} catch(e) {
  console.error('Syntax Error:', e.message);
}
