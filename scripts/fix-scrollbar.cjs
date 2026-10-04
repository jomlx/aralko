const fs = require('fs');
let s = fs.readFileSync('src/components/SettingsDialog.tsx', 'utf8');

// Remove scrollbarGutter style
s = s.replace(
  'className="flex-1 flex flex-col min-h-0" style={{ scrollbarGutter: \'stable\' }}',
  'className="flex-1 flex flex-col min-h-0"'
);

// Add pr-2.5 to all 5 inner content divs to clear the 10px scrollbar
// space-y-6 tabs (4):
s = s.replace(
  /className="space-y-6 px-6 md:px-8 pt-6 pb-8"/g,
  'className="space-y-6 px-6 md:px-8 pr-2.5 pt-6 pb-8"'
);
// space-y-4 tab (feedback, 1):
s = s.replace(
  /className="space-y-4 px-6 md:px-8 pt-4 pb-8"/g,
  'className="space-y-4 px-6 md:px-8 pr-2.5 pt-4 pb-8"'
);

const removedGutter = !s.includes("scrollbarGutter");
const pr25count = (s.match(/pr-2\.5/g) || []).length;
console.log('scrollbarGutter removed:', removedGutter);
console.log('pr-2.5 added (expect 5):', pr25count);

fs.writeFileSync('src/components/SettingsDialog.tsx', s, 'utf8');
const bytes = fs.readFileSync('src/components/SettingsDialog.tsx').slice(0, 3);
console.log('No BOM (byte 0 should be 105):', bytes[0]);
