const fs = require('fs');
const path = 'src/styles/visual-tokens.css';
let c = fs.readFileSync(path, 'utf8');
// The flag ribbon is used on thin horizontal bars (4px height), so stripes
// must go LEFT→RIGHT (90deg), not TOP→BOTTOM (180deg).
// Egyptian flag order: Red (left) → White (middle) → Black (right).
const result = c.replace(
  /flag-ribbon: linear-gradient\(180deg,[\s\S]*?#0F172A 100%\)/,
  'flag-ribbon: linear-gradient(90deg,\n    #C8102E 0%, #C8102E 33.33%,\n    #FFFFFF 33.33%, #FFFFFF 66.66%,\n    #0F172A 66.66%, #0F172A 100%)'
);
if (result === c) { console.log('NO MATCH'); process.exit(1); }
fs.writeFileSync(path, result);
console.log('OK - flag-ribbon now 90deg (left→right: red/white/black)');
