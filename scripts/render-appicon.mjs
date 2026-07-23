import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import pngToIco from 'png-to-ico';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svgPath = join(root, 'frontend', 'public', 'logo.svg');
const pngPath = join(root, 'build', 'appicon.png');
const icoPath = join(root, 'build', 'windows', 'icon.ico');

const svg = readFileSync(svgPath, 'utf8');
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1024 },
  background: 'rgba(0,0,0,0)',
});
const pngData = resvg.render().asPng();
writeFileSync(pngPath, pngData);

const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngBuffers = sizes.map((size) => {
  const sized = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0,0,0,0)',
  });
  return sized.render().asPng();
});
const ico = await pngToIco(pngBuffers);
writeFileSync(icoPath, ico);

console.log(`Wrote ${pngPath}`);
console.log(`Wrote ${icoPath}`);
