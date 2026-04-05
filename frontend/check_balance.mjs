import { readFileSync } from 'fs';
const src = readFileSync('./src/pages/AdminDashboard.jsx', 'utf8');

// Check for potential issues - template literals inside JSX attributes
const lines = src.split('\n');
let depth = 0;
lines.forEach((line, i) => {
  // Count backticks - template literals in JSX can confuse parsers
  const bticks = (line.match(/`/g) || []).length;
  if (bticks % 2 !== 0) {
    console.log(`Line ${i+1}: ODD backticks - ${line.trim().substring(0,80)}`);
  }
  // Check for bare < followed by word chars (potential JSX that's not closed)
});

// Count total curly braces at top level
let open = 0;
let close = 0;
for (const ch of src) {
  if (ch === '{') open++;
  if (ch === '}') close++;
}
console.log(`\nTotal { : ${open}`);
console.log(`Total } : ${close}`);
console.log(`Balance: ${open - close}`);
