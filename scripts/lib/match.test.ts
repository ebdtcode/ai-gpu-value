import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchTitle } from './match.ts';

const cases: Array<[string, string | null]> = [
  ['ASUS TUF Gaming NVIDIA GeForce RTX 4070 Ti SUPER OC Edition 16GB GDDR6X', 'rtx-4070-ti-super'],
  ['GIGABYTE GeForce RTX 4070 SUPER WINDFORCE OC 12G Graphics Card', 'rtx-4070-super'],
  ['GIGABYTE WINDFORCE GeForce RTX 4070 Graphics Card GV-N4070WF3OC-12GD', 'rtx-4070'],
  ['MSI Gaming GeForce RTX 4070 Ti Ventus 3X 12G OC', 'rtx-4070-ti'],
  ['ZOTAC Gaming GeForce RTX 4060 Ti 16GB Twin Edge', 'rtx-4060-ti-16gb'],
  ['PNY GeForce RTX 4060 Ti 8GB VERTO Dual Fan', 'rtx-4060-ti-8gb'],
  ['ASUS Dual GeForce RTX 4060 OC Edition 8GB', 'rtx-4060'],
  ['EVGA GeForce RTX 3080 FTW3 Ultra Gaming 10GB GDDR6X', 'rtx-3080-10gb'],
  ['EVGA GeForce RTX 3080 12GB FTW3 Ultra', 'rtx-3080-12gb'],
  ['MSI GeForce RTX 3060 Ventus 2X 12G OC', 'rtx-3060-12gb'],
  ['MSI GeForce RTX 3060 Ventus 2X 8G OC', null],
  ['Sapphire PULSE AMD Radeon RX 7900 XTX 24GB', 'rx-7900-xtx'],
  ['XFX Speedster MERC310 AMD Radeon RX 7900 XT 20GB', 'rx-7900-xt'],
  ['PowerColor Hellhound AMD Radeon RX 7900 GRE 16GB', 'rx-7900-gre'],
  ['Gigabyte Radeon RX 7600 Gaming OC 8G', 'rx-7600'],
  ['ASRock Challenger Radeon RX 7600 XT 16GB', 'rx-7600-xt'],
  ['Intel Arc A770 Limited Edition 16GB', 'arc-a770-16gb'],
  ['Sparkle Intel Arc A770 ROC 8GB', null],
  ['NVIDIA GeForce RTX 5090 ROG Astral Edition 20 OC Quad-Fan Graphics Card', 'rtx-5090'],
  ['NVIDIA GeForce RTX 5070 Ti SOLID SFF Overclocked Triple-Fan 16GB GDDR7', 'rtx-5070-ti'],
  ['ASUS ROG Strix G16 Gaming Laptop RTX 4090 16GB', null],
  ['EK-Quantum Vector Water Block for RTX 4090', null],
  ['Refurbished MSI GeForce RTX 4080 SUPRIM X', null],
  ['Some unrelated product RTX 9999', null],
];

for (const [title, expected] of cases) {
  test(`${title} -> ${expected}`, () => {
    assert.equal(matchTitle(title), expected);
  });
}
