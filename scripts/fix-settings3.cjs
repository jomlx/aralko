const { execSync } = require('child_process');
const fs = require('fs');

// Read exact committed bytes to avoid BOM
let sd = execSync('git show HEAD:src/components/SettingsDialog.tsx').toString('utf8');

// ── Fix 1 + 2: Remove negative-margin hack ─────────────────────────────────
// Scroll container: remove horizontal padding (px-6 pb-6 md:px-8 md:pb-8 pt-0)
// → keep only overflow + pt-0, all padding moves to children
sd = sd.replace(
  'flex-1 overflow-y-auto px-6 pb-6 md:px-8 md:pb-8 pt-0 relative',
  'flex-1 overflow-y-auto pt-0 relative'
);

// Sticky headers: remove -mx-6 md:-mx-8 (no longer needed), keep px-6 md:px-8 already there
sd = sd.replace(
  /sticky top-0 z-10 bg-app -mx-6 md:-mx-8 px-6 md:px-8 pt-\[23\.5px\] pb-4 border-b border-token mb-6/g,
  'sticky top-0 z-10 bg-app px-6 md:px-8 pt-[23.5px] pb-4 border-b border-token mb-6'
);

// Inner content divs (currently 5: 4x space-y-6 pb-6, 1x space-y-4 pb-6)
// Add px-6 md:px-8 pb-8 (move the removed container padding here)
sd = sd.replace(
  /className="space-y-6 pb-6"/g,
  'className="space-y-6 px-6 md:px-8 pb-8"'
);
sd = sd.replace(
  'className="space-y-4 pb-6"',
  'className="space-y-4 px-6 md:px-8 pb-8"'
);

console.log('Scroll container px removed:', !sd.includes('overflow-y-auto px-6'));
console.log('Sticky -mx removed:', !sd.includes('-mx-6'));
const stickyCount = (sd.match(/sticky top-0 z-10 bg-app px-6/g) || []).length;
console.log('Sticky headers (should be 5):', stickyCount);
const innerCount = (sd.match(/px-6 md:px-8 pb-8/g) || []).length;
console.log('Inner content divs patched (should be 5):', innerCount);

// ── Fix 3: AlertDialog backdrop suppressed by nested @base-ui Dialog context ─
// Add state for controlling the alert dialog externally.
// 1. Add deleteDialogOpen state
sd = sd.replace(
  'const [deleteError, setDeleteError] = useState(\'\');',
  'const [deleteError, setDeleteError] = useState(\'\');\n  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);'
);

// 2. Replace AlertDialog trigger inside Dialog with a plain button
const oldAlertDialog = `                <AlertDialog>
                  <AlertDialogTrigger className="p-0 m-0 border-none bg-transparent hover:bg-transparent">
                    <button
                      className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-4 py-2.5 text-sm font-semibold text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                      Delete my account
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-app border-token">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-primary">Delete Account?</AlertDialogTitle>
                      <AlertDialogDescription className="text-secondary">
                        This permanently deletes your account and all associated data — activities, sessions, chat history, settings. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-surface border-token text-secondary hover:bg-white/[0.05] hover:text-primary">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e) => { e.preventDefault(); handleDeleteAccount(); }}
                        disabled={deletingAccount}
                        className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 flex items-center gap-2"
                      >
                        {deletingAccount && <Loader2 size={14} className="animate-spin" />}
                        {deletingAccount ? 'Deleting...' : 'Yes, delete everything'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>`;

const newDeleteButton = `                <button
                  onClick={() => setDeleteDialogOpen(true)}
                  className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-4 py-2.5 text-sm font-semibold text-red-400 transition-colors"
                >
                  <Trash2 size={16} />
                  Delete my account
                </button>`;

sd = sd.replace(oldAlertDialog, newDeleteButton);

// 3. Wrap return in Fragment and append AlertDialog after </Dialog>
// Find the closing return line
sd = sd.replace(
  '    return (\n    <Dialog',
  '    return (\n    <>\n    <Dialog'
);

// Find the end: </Dialog>\n  );\n}
sd = sd.replace(
  '    </Dialog>\n  );\n}',
  `    </Dialog>
    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent className="bg-app border-token">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-primary">Delete Account?</AlertDialogTitle>
          <AlertDialogDescription className="text-secondary">
            This permanently deletes your account and all associated data — activities, sessions, chat history, settings. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {deleteError && <p className="text-xs text-red-400 -mt-2">{deleteError}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-surface border-token text-secondary hover:bg-white/[0.05] hover:text-primary">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleDeleteAccount(); }}
            disabled={deletingAccount}
            className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 flex items-center gap-2"
          >
            {deletingAccount && <Loader2 size={14} className="animate-spin" />}
            {deletingAccount ? 'Deleting...' : 'Yes, delete everything'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}`
);

console.log('deleteDialogOpen state added:', sd.includes('deleteDialogOpen'));
console.log('AlertDialog moved outside Dialog:', sd.includes('<AlertDialog open={deleteDialogOpen}'));
console.log('Fragment wrapper added:', sd.includes('<>\n    <Dialog'));

// Write without BOM
fs.writeFileSync('src/components/SettingsDialog.tsx', sd, { encoding: 'utf8' });
const firstBytes = fs.readFileSync('src/components/SettingsDialog.tsx').slice(0, 3);
console.log('First 3 bytes (no BOM):', firstBytes[0], firstBytes[1], firstBytes[2]);
