const { execSync } = require('child_process');
const fs = require('fs');

// Read exact committed bytes
let s = execSync('git show HEAD:src/components/SettingsDialog.tsx').toString('utf8');

// ══════════════════════════════════════════════════════════════════
// FIX 1: Replace sticky-in-scroll with flex-col (title shrink-0,
//         content flex-1 overflow-y-auto) per-tab.
// ══════════════════════════════════════════════════════════════════

// The outer scroll container (currently the flex-1 div with pt-0)
// becomes a plain flex-col container — NO overflow-y-auto of its own.
s = s.replace(
  'flex-1 overflow-y-auto pt-0 relative',
  'flex-1 flex flex-col min-h-0'
);
console.log('Outer container changed:', s.includes('flex-1 flex flex-col min-h-0'));

// Each TabsContent needs flex-col h-full so children fill height
s = s.replace(/TabsContent value="account" className="mt-0 outline-none h-full"/g,
              'TabsContent value="account" className="mt-0 outline-none h-full flex flex-col"');
s = s.replace(/TabsContent value="general" className="mt-0 outline-none h-full"/g,
              'TabsContent value="general" className="mt-0 outline-none h-full flex flex-col"');
s = s.replace(/TabsContent value="ai" className="mt-0 outline-none h-full"/g,
              'TabsContent value="ai" className="mt-0 outline-none h-full flex flex-col"');
s = s.replace(/TabsContent value="privacy" className="mt-0 outline-none h-full"/g,
              'TabsContent value="privacy" className="mt-0 outline-none h-full flex flex-col"');
s = s.replace(/TabsContent value="feedback" className="mt-0 outline-none h-full"/g,
              'TabsContent value="feedback" className="mt-0 outline-none h-full flex flex-col"');

// Each sticky header becomes a plain shrink-0 title row (no sticky, no z-10)
// Current:  sticky top-0 z-10 bg-app px-6 md:px-8 pt-[23.5px] pb-4 border-b border-token mb-6
// New:      shrink-0 bg-app px-6 md:px-8 pt-[23.5px] pb-4 border-b border-token
// (remove mb-6 — spacing handled by content div's pt)
s = s.replace(
  /sticky top-0 z-10 bg-app px-6 md:px-8 pt-\[23\.5px\] pb-4 border-b border-token mb-6/g,
  'shrink-0 bg-app px-6 md:px-8 pt-[23.5px] pb-4 border-b border-token'
);
console.log('Sticky headers removed:', !s.includes('sticky top-0'));

// Each inner content div: make it scrollable (flex-1 overflow-y-auto min-h-0)
// Current:  space-y-6 px-6 md:px-8 pb-8  (or space-y-4 for feedback)
// New:      flex-1 overflow-y-auto min-h-0 space-y-6 px-6 md:px-8 pb-8
s = s.replace(
  /className="space-y-6 px-6 md:px-8 pb-8"/g,
  'className="flex-1 overflow-y-auto min-h-0 space-y-6 px-6 md:px-8 pb-8"'
);
s = s.replace(
  'className="space-y-4 px-6 md:px-8 pb-8"',
  'className="flex-1 overflow-y-auto min-h-0 space-y-4 px-6 md:px-8 pb-8"'
);
console.log('Inner divs made scrollable (should be 5):', (s.match(/flex-1 overflow-y-auto min-h-0/g)||[]).length);

// ══════════════════════════════════════════════════════════════════
// FIX 2: The useEffect([user]) re-runs when user object reference
//         changes (Supabase auth listener), overwriting optimistic state.
//         Fix: track whether consent was loaded; skip the DB fetch if
//         aiConsent is already true (already acknowledged or optimistically set).
//         Also use user.id (stable string) not the user object as dependency.
// ══════════════════════════════════════════════════════════════════
const oldEffect = `  // Load AI consent state from DB
  useEffect(() => {
    if (!user) return;
    supabase.from('user_settings').select('ai_consent_acknowledged_at').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data?.ai_consent_acknowledged_at) {
          setAiConsent(true);
          setAiConsentDate(data.ai_consent_acknowledged_at);
        }
      });
  }, [user]);`;

const newEffect = `  // Load AI consent state from DB — only run when user.id changes,
  // and never overwrite state once consent is already acknowledged locally.
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    supabase.from('user_settings').select('ai_consent_acknowledged_at').eq('user_id', userId).single()
      .then(({ data, error }) => {
        if (error) console.error('[consent fetch]', error);
        // Only update if not already acknowledged locally (avoid stomping optimistic state)
        if (data?.ai_consent_acknowledged_at) {
          setAiConsent(true);
          setAiConsentDate(data.ai_consent_acknowledged_at);
        }
        // If data is null/missing acknowledged_at, leave existing state untouched
      });
  }, [userId]);`;

s = s.replace(oldEffect, newEffect);
console.log('useEffect fixed:', s.includes('const userId = user?.id'));

// Verify no BOM
fs.writeFileSync('src/components/SettingsDialog.tsx', s, { encoding: 'utf8' });
const bytes = fs.readFileSync('src/components/SettingsDialog.tsx').slice(0, 3);
console.log('First 3 bytes (no BOM):', bytes[0], bytes[1], bytes[2]);
