const fs = require('fs');

let content = fs.readFileSync('src/components/SettingsDialog.tsx', 'utf8');
const hasCRLF = content.includes('\r\n');
const NL = hasCRLF ? '\r\n' : '\n';

// 1. Add Switch import
if (!content.includes('./ui/switch')) {
  content = content.replace("import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';", "import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';" + NL + "import { Switch } from './ui/switch';");
}

// 2. Change margin
content = content.replace(
  '<h2 className="text-lg font-semibold text-primary mb-1">Data & Privacy</h2>',
  '<h2 className="text-lg font-semibold text-primary mb-4">Data & Privacy</h2>'
);

// 3. Remove card wrapper Section 1
content = content.replace(
  '<div className="rounded-2xl border border-token bg-surface p-5 space-y-3">' + NL + '                  <h3 className="text-sm font-semibold text-primary">What we store</h3>',
  '<div className="space-y-3 mt-3">' + NL + '                  <h3 className="text-sm font-semibold text-primary">What we store</h3>'
);

// 4. Remove card wrapper Section 2
content = content.replace(
  '<div className="rounded-2xl border border-token bg-surface p-5 space-y-3">' + NL + '                  <h3 className="text-sm font-semibold text-primary">AI & Data Processing</h3>',
  '<div className="h-px bg-white/5 my-6" />' + NL + NL + '                <div className="space-y-3">' + NL + '                  <div className="flex items-center justify-between gap-4">' + NL + '                    <h3 className="text-sm font-semibold text-primary">AI & Data Processing</h3>' + NL + '                    <Switch checked={aiConsent} disabled={aiConsent || consentLoading} onCheckedChange={handleToggleConsent} />' + NL + '                  </div>'
);

// 5. Replace checkbox content
const oldCheckboxRegex = /<label className=\{`flex items-start gap-3 rounded-xl border p-4 transition-colors \$\{aiConsent \? 'border-accent\/40 bg-accent\/5 cursor-default' : 'border-token bg-app cursor-pointer hover:bg-white\/\[0\.03\]'\}`\}>[\s\S]*?<\/label>/;
const newConsentFeedback = `{aiConsent && aiConsentDate && (
                    <p className="text-xs text-success mt-1 flex items-center gap-1.5"><Check size={12} /> Acknowledged {new Date(aiConsentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  )}
                  {!aiConsent && <p className="text-xs text-muted mt-1">Toggle to acknowledge. This does not block any feature.</p>}`.replace(/\n/g, NL);

content = content.replace(oldCheckboxRegex, newConsentFeedback);

// 6. Remove card wrapper Section 3
content = content.replace(
  '<div className="rounded-2xl border border-token bg-surface p-5 space-y-3">' + NL + '                  <h3 className="text-sm font-semibold text-primary">Export your data</h3>',
  '<div className="h-px bg-white/5 my-6" />' + NL + NL + '                <div className="space-y-3">' + NL + '                  <h3 className="text-sm font-semibold text-primary">Export your data</h3>'
);

// 7. Remove card wrapper Section 4
content = content.replace(
  '<div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 space-y-3">' + NL + '                  <h3 className="text-sm font-semibold text-red-400">Delete Account</h3>',
  '<div className="h-px bg-white/5 my-6" />' + NL + NL + '                <div className="space-y-3">' + NL + '                  <h3 className="text-sm font-semibold text-red-400">Delete Account</h3>'
);

fs.writeFileSync('src/components/SettingsDialog.tsx', content, 'utf8');
console.log('Patch applied.');
