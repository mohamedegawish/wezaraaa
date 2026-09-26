const fs = require('fs');
const path = 'src/styles/visual-tokens.css';
let c = fs.readFileSync(path, 'utf8');
// Fix Egyptian flag stripe order: red(top) → white(mid) → black(bottom)
const result = c.replace(
  /flag-ribbon: linear-gradient\([\d]+deg,[\s\S]*?#C8102E[\s\S]*?\)/,
  'flag-ribbon: linear-gradient(180deg,\n    #C8102E 0%, #C8102E 33.33%,\n    #FFFFFF 33.33%, #FFFFFF 66.66%,\n    #0F172A 66.66%, #0F172A 100%)'
);
if (result === c) { console.log('NO MATCH'); process.exit(1); }
fs.writeFileSync(path, result);
console.log('OK - fixed flag order: red→white→black vertical');
