const fs = require('fs');

// Read from disk
let s = fs.readFileSync('src/components/SettingsDialog.tsx', 'utf8');

// Add ScrollArea import
s = s.replace(
  "import { Switch } from './ui/switch';",
  "import { Switch } from './ui/switch';\nimport { ScrollArea } from './ui/scroll-area';"
);

const OLD_OPEN_6 = '              <div className="flex-1 overflow-y-auto min-h-0 space-y-6 px-6 md:px-8 pb-8">';
const NEW_OPEN_6 = '              <ScrollArea className="flex-1 min-h-0">\r\n                <div className="space-y-6 px-6 md:px-8 pt-6 pb-8">';

const OLD_OPEN_4 = '              <div className="flex-1 overflow-y-auto min-h-0 space-y-4 px-6 md:px-8 pb-8">';
const NEW_OPEN_4 = '              <ScrollArea className="flex-1 min-h-0">\r\n                <div className="space-y-4 px-6 md:px-8 pt-4 pb-8">';

while (s.includes(OLD_OPEN_6)) s = s.replace(OLD_OPEN_6, NEW_OPEN_6);
while (s.includes(OLD_OPEN_4)) s = s.replace(OLD_OPEN_4, NEW_OPEN_4);

// CRLF-aware closing pattern
const OLD_CLOSE = '              </div>\r\n            </TabsContent>';
const NEW_CLOSE = '                </div>\r\n              </ScrollArea>\r\n            </TabsContent>';

let closingCount = (s.split(OLD_CLOSE).length - 1);
console.log('Found CRLF closing patterns (expect 5):', closingCount);

while (s.includes(OLD_CLOSE)) s = s.replace(OLD_CLOSE, NEW_CLOSE);

const openCount = (s.match(/<ScrollArea /g) || []).length;
const closeCount = (s.match(/<\/ScrollArea>/g) || []).length;
console.log('ScrollArea opens:', openCount, '| closes:', closeCount, '(should both be 5)');
console.log('ScrollArea import:', s.includes("import { ScrollArea } from './ui/scroll-area';"));

fs.writeFileSync('src/components/SettingsDialog.tsx', s, 'utf8');
const bytes = fs.readFileSync('src/components/SettingsDialog.tsx').slice(0, 3);
console.log('First 3 bytes (no BOM):', bytes[0], bytes[1], bytes[2]);
