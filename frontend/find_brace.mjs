import { readFileSync } from 'fs';
const src = readFileSync('./src/pages/AdminDashboard.jsx', 'utf8');
const lines = src.split('\n');

let depth = 0;
let maxDepth = 0;
let maxLine = 0;

lines.forEach((line, i) => {
  // Skip strings (rough approximation - won't handle all cases)
  let inString = false;
  let inTemplate = false;
  let escaped = false;
  
  for (const ch of line) {
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '`') { inTemplate = !inTemplate; continue; }
    if (inTemplate) continue;
    if (!inString && (ch === '"' || ch === "'")) { inString = true; continue; }
    if (inString && (ch === '"' || ch === "'")) { inString = false; continue; }
    if (!inString) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
    }
  }
  
  if (depth > maxDepth) {
    maxDepth = depth;
    maxLine = i + 1;
  }
});

console.log(`Final depth: ${depth}`);
console.log(`Max depth: ${maxDepth} at line ${maxLine}`);

// Now find the specific unbalanced part
let d2 = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let inString = false;
  let escaped = false;
  
  for (const ch of line) {
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (!inString && (ch === '"' || ch === "'")) { inString = true; continue; }
    if (inString && (ch === '"' || ch === "'")) { inString = false; continue; }
    if (!inString) {
      if (ch === '{') d2++;
      if (ch === '}') d2--;
    }
  }
  
  // If after a closing brace line we're still at 1, this might be the problem area
  if (i > 1000 && d2 === 1) {
    console.log(`Still at depth 1 after line ${i+1}: ${line.trim().substring(0,60)}`);
    break;
  }
}
