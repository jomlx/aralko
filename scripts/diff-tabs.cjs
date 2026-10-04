const { execSync } = require('child_process');
const s = execSync('git show HEAD:src/components/SettingsDialog.tsx').toString('utf8');
const lines = s.split('\n');

const accStart = lines.findIndex(l => l.includes('TabsContent value="account"'));
const genStart = lines.findIndex(l => l.includes('TabsContent value="general"'));

console.log('=== ACCOUNT TAB ===');
lines.slice(accStart, accStart + 22).forEach((l, i) => console.log((accStart + i + 1) + ': ' + l));

console.log('\n=== GENERAL TAB ===');
lines.slice(genStart, genStart + 14).forEach((l, i) => console.log((genStart + i + 1) + ': ' + l));
