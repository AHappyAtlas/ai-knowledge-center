const fs = require('node:fs');
const source = fs.readFileSync('src/index.ts', 'utf8');
if (!source.includes('export function greeting')) throw new Error('Expected exported greeting function.');
console.log('example lint ok');
