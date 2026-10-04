const fs = require('fs');
let s = fs.readFileSync('src/components/SettingsDialog.tsx', 'utf8');

const lines = s.split('\n');
const newLines = lines.filter(l => !l.includes("console.log('[consent"));

fs.writeFileSync('src/components/SettingsDialog.tsx', newLines.join('\n'), 'utf8');
