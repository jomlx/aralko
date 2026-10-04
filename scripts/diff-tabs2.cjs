const { execSync } = require('child_process');
const s = execSync('git show HEAD:src/components/SettingsDialog.tsx').toString('utf8');
const lines = s.split('\n');

const accStart = lines.findIndex(l => l.includes('TabsContent value="account"'));
const genStart = lines.findIndex(l => l.includes('TabsContent value="general"'));

// Account: header div + first 5 content lines
console.log('=== ACCOUNT: header + first content lines ===');
lines.slice(accStart, accStart + 16).forEach((l, i) => console.log((accStart + i + 1) + ': ' + l));

console.log('\n=== GENERAL: header + first content lines ===');
lines.slice(genStart, genStart + 10).forEach((l, i) => console.log((genStart + i + 1) + ': ' + l));

// Also print last lines of Account tab before </TabsContent>
const accEnd = lines.findIndex((l, i) => i > accStart && l.includes('</TabsContent>'));
console.log('\n=== ACCOUNT: last 6 lines before </TabsContent> ===');
lines.slice(accEnd - 5, accEnd + 1).forEach((l, i) => console.log((accEnd - 5 + i + 1) + ': ' + l));

const genEnd = lines.findIndex((l, i) => i > genStart && l.includes('</TabsContent>'));
console.log('\n=== GENERAL: last 6 lines before </TabsContent> ===');
lines.slice(genEnd - 5, genEnd + 1).forEach((l, i) => console.log((genEnd - 5 + i + 1) + ': ' + l));
