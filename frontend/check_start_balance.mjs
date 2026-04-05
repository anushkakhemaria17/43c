import { readFileSync } from 'fs';
const content = readFileSync('./src/pages/AdminDashboard.jsx', 'utf8');
const lines = content.split('\n');

let balance = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '{') balance++;
    if (line[j] === '}') balance--;
  }
  if (i < 100) {
      console.log(`${i + 1}: ${balance} | ${line.trim().substring(0, 50)}`);
  }
}
