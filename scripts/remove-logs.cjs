const fs = require('fs');
let s = fs.readFileSync('src/components/SettingsDialog.tsx', 'utf8');

const lines = s.split('\n');
const newLines = lines.filter(l => !(l.includes('console.log') && l.includes('[consent')));

fs.writeFileSync('src/components/SettingsDialog.tsx', newLines.join('\n'), 'utf8');
console.log('Removed', lines.length - newLines.length, 'lines.');
