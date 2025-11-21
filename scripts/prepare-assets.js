const fs = require('fs');
const path = require('path');

const reactRoot = path.join(path.dirname(require.resolve('react/package.json')));
const reactDomRoot = path.join(path.dirname(require.resolve('react-dom/package.json')));
const babelRoot = path.join(path.dirname(require.resolve('@babel/standalone/package.json')));
const normalizeRoot = path.join(path.dirname(require.resolve('modern-normalize/package.json')));

const assets = [
  { src: path.join(reactRoot, 'umd/react.development.js'), dest: 'react.development.js' },
  { src: path.join(reactDomRoot, 'umd/react-dom.development.js'), dest: 'react-dom.development.js' },
  { src: path.join(babelRoot, 'babel.min.js'), dest: 'babel.min.js' },
  { src: path.join(normalizeRoot, 'modern-normalize.css'), dest: 'modern-normalize.min.css' },
];

const outDir = path.join(__dirname, '..', 'public', 'vendor');
fs.mkdirSync(outDir, { recursive: true });

for (const asset of assets) {
  const targetPath = path.join(outDir, asset.dest);
  fs.copyFileSync(asset.src, targetPath);
}

console.log(`Prepared vendor assets in ${outDir}`);
