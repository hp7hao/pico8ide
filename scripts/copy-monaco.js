const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'monaco-editor', 'min', 'vs');
const dest = path.join(__dirname, '..', 'resources', 'monaco');

if (!fs.existsSync(src)) {
    console.log('monaco-editor not installed yet, skipping copy.');
    process.exit(0);
}

// Check if copy is needed by comparing source mod time
function getNewestMtime(dir) {
    let newest = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            newest = Math.max(newest, getNewestMtime(full));
        } else {
            newest = Math.max(newest, fs.statSync(full).mtimeMs);
        }
    }
    return newest;
}

function copyDirSync(srcDir, destDir) {
    fs.mkdirSync(destDir, { recursive: true });
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
        const s = path.join(srcDir, entry.name);
        const d = path.join(destDir, entry.name);
        if (entry.isDirectory()) {
            copyDirSync(s, d);
        } else {
            fs.copyFileSync(s, d);
        }
    }
}

// Skip if destination is up to date
if (fs.existsSync(dest)) {
    const srcTime = getNewestMtime(src);
    const destTime = getNewestMtime(dest);
    if (destTime >= srcTime) {
        console.log('resources/monaco/ is up to date.');
        process.exit(0);
    }
}

console.log('Copying monaco-editor/min/vs/ -> resources/monaco/ ...');
// Remove old destination
if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
}

copyDirSync(src, dest);
console.log('Done.');
