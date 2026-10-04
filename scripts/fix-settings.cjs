const fs = require('fs');

let content = fs.readFileSync('src/components/SettingsDialog.tsx', 'utf8');

// 1. Import AlertDialog
if (!content.includes('AlertDialog,')) {
  content = content.replace(
    "import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';",
    "import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';\nimport { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';"
  );
}

// 2. Fix handleToggleConsent optimistic update
const oldHandler = `  const handleToggleConsent = async () => {
    if (!user || aiConsent) return; // read-only once acknowledged
    setConsentLoading(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from('user_settings').upsert(
      { user_id: user.id, ai_consent_acknowledged_at: now },
      { onConflict: 'user_id' }
    );
    if (!error) { setAiConsent(true); setAiConsentDate(now); }
    setConsentLoading(false);
  };`;

const newHandler = `  const handleToggleConsent = async (checked: boolean) => {
    if (!user || aiConsent) return; // read-only once acknowledged
    setAiConsent(true);
    const now = new Date().toISOString();
    setAiConsentDate(now);
    const { error } = await supabase.from('user_settings').upsert(
      { user_id: user.id, ai_consent_acknowledged_at: now },
      { onConflict: 'user_id' }
    );
    if (error) {
      console.error('Toggle error:', error);
      setAiConsent(false);
      setAiConsentDate(null);
    }
  };`;
content = content.replace(oldHandler, newHandler);

// 3. Delete Account AlertDialog
const oldDeleteSectionRegex = /\{!\s*showDeleteConfirm\s*\?\s*\(\s*<button[\s\S]*?<\/button>\s*\)\s*:\s*\([\s\S]*?\}\s*<\/div>\s*\)\}/;

const newDeleteSection = `<AlertDialog>
                  <AlertDialogTrigger asChild>
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
                        Are you sure? This permanently deletes your account and all associated data. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    {deleteError && <p className="text-xs text-red-400 mt-2">{deleteError}</p>}
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-surface border-token text-secondary hover:bg-white/[0.05] hover:text-primary">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteAccount();
                        }}
                        disabled={deletingAccount}
                        className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 flex items-center"
                      >
                        {deletingAccount && <Loader2 size={14} className="animate-spin mr-2" />}
                        {deletingAccount ? 'Deleting...' : 'Yes, delete everything'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>`;

content = content.replace(oldDeleteSectionRegex, newDeleteSection);

// 4. Make all Tab headings sticky
const tabs = ['Account', 'General', 'AI', 'Data & Privacy', 'Send Feedback'];
for (const tab of tabs) {
  const regex = new RegExp('<h2 className="text-lg font-semibold text-primary mb-[0-9]+">' + tab + '</h2>');
  content = content.replace(regex, '<div className="sticky top-0 z-10 bg-app pb-4 pt-[23.5px] -mt-[23.5px] border-b border-token mb-6 -mx-6 md:-mx-8 px-6 md:px-8">\\n                <h2 className="text-lg font-semibold text-primary">' + tab + '</h2>\\n              </div>');
}

fs.writeFileSync('src/components/SettingsDialog.tsx', content, 'utf8');
console.log('Patch applied successfully.');
