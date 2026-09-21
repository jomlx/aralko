import fs from 'fs';
import path from 'path';

const SRC_DIR = 'c:\\Users\\pc\\OneDrive\\Desktop\\aralko\\src';

const replacements = [
  // Backgrounds
  { regex: /bg-\[#(121622|1a1e27)\]/g, replacement: 'bg-surface' },
  
  // Borders
  { regex: /border-white\/\[[0-9.]+\]/g, replacement: 'border-token' },
  { regex: /border-white\/[0-9]+/g, replacement: 'border-token' },
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

