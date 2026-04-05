import { readFileSync } from 'fs';
const src = readFileSync('./src/pages/AdminDashboard.jsx', 'utf8');
const lines = src.split('\n');
lines.forEach((line, i) => {
  if (line.includes('<>') || line.includes('</>')) {
    console.log(`Line ${i+1}: ${line.trim().substring(0,100)}`);
  }
});
