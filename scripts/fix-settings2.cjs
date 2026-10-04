// Read the committed version via git show (binary), write to disk, then patch
const { execSync } = require('child_process');
const fs = require('fs');

// Use git show to get the exact committed bytes
const sdBuf = execSync('git show HEAD:src/components/SettingsDialog.tsx');
const adBuf = execSync('git show HEAD:src/components/ui/alert-dialog.tsx');

let sd = sdBuf.toString('utf8');
let ad = adBuf.toString('utf8');

// Verify no bad chars before patching
const lines = sd.split('\n');
let badBefore = 0;
for (const line of lines) {
  for (let i = 0; i < line.length; i++) {
    const c = line.charCodeAt(i);
    if (c >= 0x80 && c <= 0xFF) { badBefore++; break; }
  }
}
console.log('Bad lines in HEAD SettingsDialog (should be 0):', badBefore);

// Fix 1+2: pt-[23.5px] → pt-0 on scroll container, pt-6 → pt-[23.5px] on sticky headers
sd = sd.replace(
  'flex-1 overflow-y-auto px-6 pb-6 md:px-8 md:pb-8 pt-[23.5px] relative',
  'flex-1 overflow-y-auto px-6 pb-6 md:px-8 md:pb-8 pt-0 relative'
);
sd = sd.replace(
  /sticky top-0 z-10 bg-app -mx-6 md:-mx-8 px-6 md:px-8 pt-6 pb-4 border-b border-token mb-6/g,
  'sticky top-0 z-10 bg-app -mx-6 md:-mx-8 px-6 md:px-8 pt-[23.5px] pb-4 border-b border-token mb-6'
);
console.log('Scroll pt-0:', sd.includes('pt-0 relative'));
console.log('Sticky pt-[23.5px] count:', (sd.match(/pt-\[23\.5px\]/g) || []).length);

// Fix 3: alert-dialog overlay + popup z-50 → z-[60]
ad = ad.replace(
  '"fixed inset-0 isolate z-50 bg-black/60 duration-100 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"',
  '"fixed inset-0 isolate z-[60] bg-black/60 duration-100 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"'
);
ad = ad.replace(
  '"group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid',
  '"group/alert-dialog-content fixed top-1/2 left-1/2 z-[60] grid'
);
console.log('alert-dialog overlay z-[60]:', ad.includes('z-[60] bg-black'));
console.log('alert-dialog popup z-[60]:', ad.includes('z-[60] grid'));

// Write without BOM
fs.writeFileSync('src/components/SettingsDialog.tsx', sd, { encoding: 'utf8' });
fs.writeFileSync('src/components/ui/alert-dialog.tsx', ad, { encoding: 'utf8' });

// Verify no BOM
const firstBytes = fs.readFileSync('src/components/SettingsDialog.tsx').slice(0, 3);
console.log('First 3 bytes:', firstBytes[0], firstBytes[1], firstBytes[2], '(no BOM = not 239 187 191)');
