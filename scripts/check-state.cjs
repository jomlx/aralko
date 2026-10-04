const { execSync } = require('child_process');
const s = execSync('git show HEAD:src/components/SettingsDialog.tsx', { encoding: 'utf8' });

console.log('1. Headers with pt-6 + relative z-10 (expect 5):', (s.match(/shrink-0 relative z-10 bg-app px-6 md:px-8 pt-6 pb-4 border-b border-token/g) || []).length);
console.log('2. pt-[23.5px] remaining (expect 0):', (s.match(/pt-\[23\.5px\]/g) || []).length);
console.log('3. sticky keyword remaining (expect 0):', (s.match(/sticky top/g) || []).length);
console.log('4. TabsContent with flex flex-col (expect 5):', (s.match(/TabsContent value=.*flex flex-col/g) || []).length);
console.log('5. flex-1 overflow-y-auto min-h-0 (expect 5):', (s.match(/flex-1 overflow-y-auto min-h-0/g) || []).length);
console.log('6. mt-3 on account first card (expect false):', s.includes('bg-surface p-4 mt-3'));
console.log('7. [consent] console.log lines (expect 0):', (s.match(/console\.log.*\[consent/g) || []).length);
console.log('8. useEffect dep [userId] (expect true):', s.includes('}, [userId]);'));
// Check the consent effect body for setAiConsent(false)
const effectStart = s.indexOf('// Load AI consent state from DB');
const effectEnd = s.indexOf('// ── Privacy handlers');
const effectBody = s.slice(effectStart, effectEnd);
console.log('9. setAiConsent(false) inside consent effect (expect false):', effectBody.includes('setAiConsent(false)'));
console.log('10. deleteDialogOpen state (expect true):', s.includes('deleteDialogOpen'));
console.log('11. AlertDialog open={deleteDialogOpen} (expect true):', s.includes('<AlertDialog open={deleteDialogOpen}'));
console.log('12. Fragment <> wrapping Dialog (expect true):', s.includes('<>\n    <Dialog') || s.includes('<>\r\n    <Dialog'));
