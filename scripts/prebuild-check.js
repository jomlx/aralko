import fs from 'fs';
import path from 'path';

function scanDir(dir) {
    let hasError = false;
    const files = fs.readdirSync(dir);
    
    for (const f of files) {
        const fullPath = path.join(dir, f);
        if (fs.statSync(fullPath).isDirectory()) {
            if (hasError = scanDir(fullPath) || hasError);
        } else if (f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.html')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                let badChar = false;
                for (let j = 0; j < line.length; j++) {
                    const code = line.charCodeAt(j);
                    if ((code >= 0x0080 && code <= 0x00FF) || code === 0xFFFD) {
                        badChar = true;
                        break;
                    }
                }
                if (badChar || line.includes('\\u{') || line.includes('\\U000')) {
                    console.error(`Prebuild check failed: Invalid characters found in ${fullPath}:${i + 1}`);
                    hasError = true;
                }
            }
        }
    }
    return hasError;
}

const dirsToScan = ['src', 'public'];
let hasError = false;

for (const dir of dirsToScan) {
    if (fs.existsSync(dir)) {
        if (scanDir(dir)) hasError = true;
    }
}

if (fs.existsSync('index.html')) {
    const content = fs.readFileSync('index.html', 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let badChar = false;
        for (let j = 0; j < line.length; j++) {
            const code = line.charCodeAt(j);
            if ((code >= 0x0080 && code <= 0x00FF) || code === 0xFFFD) {
                badChar = true;
                break;
            }
        }
        if (badChar || line.includes('\\u{') || line.includes('\\U000')) {
            console.error(`Prebuild check failed: Invalid characters found in index.html:${i + 1}`);
            hasError = true;
        }
    }
}

if (hasError) {
    process.exit(1);
}
