import fs from 'fs';
import path from 'path';

const SRC_DIR = 'c:\\Users\\pc\\OneDrive\\Desktop\\aralko\\src';

const replacements = [
  // Primary buttons (e.g., Save, Generate, etc.)
  { regex: /rounded-xl bg-accent hover:bg-violet-700 px-5 py-2\.5 text-sm font-medium text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed/g, replacement: 'btn btn-primary' },
  { regex: /rounded-xl bg-accent hover:bg-violet-700 px-5 py-2 text-sm font-medium text-primary transition-colors/g, replacement: 'btn btn-primary' },
  { regex: /rounded-xl bg-accent hover:bg-accent px-6 py-3 font-medium text-primary hover:scale-105 transition-all shadow-xl shadow-accent\/20/g, replacement: 'btn btn-primary px-6 py-3 shadow-xl shadow-accent/20' }, // Hero button
  { regex: /rounded-xl bg-accent hover:bg-accent py-2\.5 text-sm font-semibold text-primary transition-all shadow-lg shadow-accent\/20/g, replacement: 'btn btn-primary w-full shadow-lg shadow-accent/20' },
  { regex: /mt-4 flex items-center gap-2 rounded-xl bg-accent hover:bg-violet-700 px-5 py-2\.5 text-sm font-medium text-primary transition-colors/g, replacement: 'btn btn-primary mt-4' },
  
  // Secondary / Cancel buttons
  { regex: /rounded-xl bg-white\/\[0\.05\] hover:bg-white\/\[0\.1\] px-5 py-2 text-sm font-medium text-primary transition-colors/g, replacement: 'btn btn-secondary' },
  
];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;
      
      for (const { regex, replacement } of replacements) {
        if (regex.test(content)) {
          content = content.replace(regex, replacement);
          modified = true;
        }
      }
      
      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory(SRC_DIR);
console.log("Done.");

