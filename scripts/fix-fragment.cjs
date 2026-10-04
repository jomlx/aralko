const fs = require('fs');
let s = fs.readFileSync('src/components/SettingsDialog.tsx', 'utf8');

// Add Fragment open tag around the return
s = s.replace('  return (\n    <Dialog', '  return (\n    <>\n    <Dialog');

// Add Fragment close tag after the last </AlertDialog>
// Find last </AlertDialog> and append </>
const lastAlertClose = s.lastIndexOf('    </AlertDialog>\n');
if (lastAlertClose === -1) {
  console.error('Could not find last </AlertDialog>');
  process.exit(1);
}
const insertAt = lastAlertClose + '    </AlertDialog>\n'.length;
s = s.slice(0, insertAt) + '    </>\n' + s.slice(insertAt);

console.log('Fragment open:', s.includes('<>\n    <Dialog'));
console.log('Fragment close:', s.includes('</AlertDialog>\n    </>'));

fs.writeFileSync('src/components/SettingsDialog.tsx', s, { encoding: 'utf8' });
const bytes = fs.readFileSync('src/components/SettingsDialog.tsx').slice(0, 3);
console.log('First 3 bytes (no BOM):', bytes[0], bytes[1], bytes[2]);
