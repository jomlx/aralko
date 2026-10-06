// Add a line here whenever a fix must not be removed.
import fs from 'fs';

const checks = [
  { file: 'src/pages/AuthPage.tsx', mustContain: ['is_username_available'] },
  { file: 'src/components/SettingsDialog.tsx', mustContain: ['is_username_available', 'delete_my_account'] },
  { file: 'src/hooks/useUserSettings.ts', mustContain: ['23505', 'PGRST116'] },
  { file: 'src/hooks/useAIConsent.ts', mustContain: ['ai_consent_acknowledged_at'] },
  { file: 'src/components/community/LeaderboardView.tsx', mustContain: ['leaderboard_public'], mustNotContain: ["from('user_settings')\\n        .select('user_id, display_name"] }
];

let failed = false;

for (const check of checks) {
  if (!fs.existsSync(check.file)) {
    console.error(`Missing file: ${check.file}`);
    failed = true;
    continue;
  }
  const content = fs.readFileSync(check.file, 'utf8');
  if (check.mustContain) {
    for (const str of check.mustContain) {
      if (!content.includes(str)) {
        console.error(`File ${check.file} is missing required string: "${str}"`);
        failed = true;
      }
    }
  }
  if (check.mustNotContain) {
    for (const str of check.mustNotContain) {
      if (content.includes(str)) {
        console.error(`File ${check.file} contains forbidden string: "${str}"`);
        failed = true;
      }
    }
  }
}

if (failed) {
  process.exit(1);
}
