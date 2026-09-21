import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function (file) {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'src'));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // We skip changing Spotify things in Spotify components for now, handle manually
  if (file.includes('SpotifyPremiumPlayer') || file.includes('useSpotifyPlayer') || file.includes('MusicPlayer')) {
    // Actually, MusicPlayer might have some other greens? No.
    // Let's do a safe replace for everything else
  }

  const originalContent = content;

  // Replacements
  content = content.replace(/bg-emerald-500\/10/g, 'bg-success-muted');
  content = content.replace(/bg-emerald-500\/15/g, 'bg-success-muted');
  content = content.replace(/bg-emerald-500\/20/g, 'bg-success/20');
  content = content.replace(/border-emerald-500\/20/g, 'border-success/20');
  content = content.replace(/border-emerald-500\/40/g, 'border-success/40');
  content = content.replace(/border-emerald-500\/50/g, 'border-success/50');
  content = content.replace(/border-emerald-500/g, 'border-success');
  
  content = content.replace(/bg-emerald-500/g, 'bg-success');
  content = content.replace(/bg-emerald-600/g, 'bg-success');
  
  content = content.replace(/text-emerald-300/g, 'text-success');
  content = content.replace(/text-emerald-400/g, 'text-success');
  content = content.replace(/text-emerald-500/g, 'text-success');
  content = content.replace(/text-emerald-600/g, 'text-success');
  
  content = content.replace(/text-green-600/g, 'text-success');
  content = content.replace(/bg-green-600/g, 'bg-success');

  content = content.replace(/from-emerald-500 to-teal-400/g, 'from-success to-emerald-500'); // Quiz gradient

  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log('Updated', file);
  }
}

