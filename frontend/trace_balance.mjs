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
  // Print where it stays at 2 for a while without being in a block
  if (balance === 2 && line.trim() === '') {
      // maybe this is a gap between functions
  }
  if (i >= 300 && i < 400) {
      console.log(`${i + 1}: ${balance} | ${line.trim().substring(0, 60)}`);
  }
}
