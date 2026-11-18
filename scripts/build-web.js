const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const wwwDir = path.join(rootDir, 'www');

// Delete www if exists
if (fs.existsSync(wwwDir)) {
  fs.rmSync(wwwDir, { recursive: true, force: true });
}

fs.mkdirSync(wwwDir, { recursive: true });

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else if (exists) {
    fs.copyFileSync(src, dest);
  }
}

// 1. Copy all *.html files in root
const files = fs.readdirSync(rootDir);
files.forEach((file) => {
  if (file.endsWith('.html')) {
    fs.copyFileSync(path.join(rootDir, file), path.join(wwwDir, file));
  }
});

// 2. Copy directories: css, js, fonts (if exists)
['css', 'js', 'fonts'].forEach((dir) => {
  const srcPath = path.join(rootDir, dir);
  if (fs.existsSync(srcPath)) {
    copyRecursiveSync(srcPath, path.join(wwwDir, dir));
  }
});

// 3. Copy explicit root files
['manifest.json', 'version.js', 'icon-192.png', 'icon-512.png'].forEach((file) => {
  const srcPath = path.join(rootDir, file);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, path.join(wwwDir, file));
  }
});

console.log('Web build complete: copied assets to www/');
