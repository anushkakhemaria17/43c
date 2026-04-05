import { readFileSync } from 'fs';
const content = readFileSync('./src/pages/AdminDashboard.jsx', 'utf8');
const lines = content.split('\n');

let balance = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Simple brace counting
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '{') balance++;
    if (line[j] === '}') balance--;
  }
  // Print balance if it's high and we're at a potential boundary
  if (line.includes(');') || line.includes('});')) {
      // console.log(`Line ${i + 1}: balance ${balance}`);
  }
}
console.log(`Final balance: ${balance}`);

// Let's find where it stops returning to a reasonable level for top-level component
balance = 0;
let lastZeroLine = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
      if (line[j] === '{') balance++;
      if (line[j] === '}') balance--;
  }
  if (balance === 1 && line.trim() === 'return (') {
      // console.log(`Found return at line ${i+1}`);
  }
}

// Check the very end of the file specifically
console.log('--- Last 20 lines balance check ---');
balance = 0;
// We need the balance *before* the last 20 lines to be accurate
// but let's just count them all again and print per line
balance = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        if (line[j] === '{') balance++;
        if (line[j] === '}') balance--;
    }
    if (i > lines.length - 30) {
        console.log(`${i + 1}: ${balance} | ${line.trim()}`);
    }
}
