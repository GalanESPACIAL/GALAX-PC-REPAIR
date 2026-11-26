#!/usr/bin/env node
/**
 * Genera ilustraciones neutras de categoría para productos sin fotografía real.
 * No representan un modelo específico: se muestran siempre como "Imagen referencial".
 */
import fs from 'node:fs';
import path from 'node:path';

const dir = 'assets/img/placeholders';
fs.mkdirSync(dir, { recursive: true });

const wrap = (id, label, from, to, art) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="bg-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient>
    <linearGradient id="screen-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1220"/><stop offset="1" stop-color="#111d33"/>
    </linearGradient>
    <filter id="shadow-${id}" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#020617" flood-opacity=".55"/>
    </filter>
  </defs>
  <rect width="800" height="600" fill="url(#bg-${id})"/>
  <circle cx="96" cy="86" r="210" fill="#ffffff" opacity=".045"/>
  <circle cx="716" cy="536" r="250" fill="#ffffff" opacity=".035"/>
  <path d="M0 500L800 380V600H0Z" fill="#020617" opacity=".22"/>
  <g opacity=".12" stroke="#ffffff" stroke-width="1">
    ${Array.from({ length: 9 }, (_, i) => `<path d="M${i * 100} 0V600"/>`).join('')}
    ${Array.from({ length: 6 }, (_, i) => `<path d="M0 ${i * 100}H800"/>`).join('')}
  </g>
  <g filter="url(#shadow-${id})">${art}</g>
  <text x="52" y="64" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#ffffff" opacity=".82" letter-spacing="2">GALAX PC REPAIR</text>
  <text x="52" y="556" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="600" fill="#ffffff" opacity=".62" letter-spacing="1.6">IMAGEN REFERENCIAL</text>
  <rect x="52" y="92" width="66" height="3" rx="1.5" fill="#ffffff" opacity=".55"/>
</svg>`;

const files = {
  'laptop.svg': wrap('lap', 'Ilustración referencial de laptop', '#172554', '#0e7490', `
    <rect x="190" y="190" width="420" height="270" rx="20" fill="#0b1220"/>
    <rect x="212" y="214" width="376" height="220" rx="10" fill="url(#screen-lap)"/>
    <path d="M240 400l70-94 55 58 72-102 90 138z" fill="#22d3ee" opacity=".18"/>
    <path d="M212 214h376v220H212z" fill="none" stroke="#ffffff" stroke-opacity=".1"/>
    <circle cx="400" cy="206" r="3" fill="#334155"/>
    <path d="M140 460h520l44 60a10 10 0 0 1-8 16H104a10 10 0 0 1-8-16z" fill="#cbd5e1"/>
    <path d="M330 460h140l12 24H318z" fill="#94a3b8" opacity=".8"/>
    <circle cx="612" cy="180" r="46" fill="#22d3ee" opacity=".12"/>
    <path d="M592 180h40M612 160v40" stroke="#67e8f9" stroke-width="4" stroke-linecap="round"/>`),
  'desktop.svg': wrap('des', 'Ilustración referencial de computadora', '#2e1065', '#4f46e5', `
    <rect x="210" y="150" width="380" height="250" rx="16" fill="#0b1220"/>
    <rect x="232" y="172" width="336" height="206" rx="8" fill="url(#screen-des)"/>
    <path d="M270 340l64-80 58 62 70-100 68 118z" fill="#a78bfa" opacity=".2"/>
    <rect x="370" y="400" width="60" height="52" fill="#94a3b8"/>
    <rect x="300" y="452" width="200" height="18" rx="9" fill="#cbd5e1"/>
    <rect x="608" y="170" width="88" height="300" rx="14" fill="#111827" stroke="#475569"/>
    <circle cx="652" cy="218" r="18" fill="#8b5cf6" opacity=".8"/>
    <circle cx="652" cy="270" r="10" fill="#334155"/><circle cx="652" cy="306" r="10" fill="#334155"/>
    <rect x="628" y="352" width="48" height="6" rx="3" fill="#8b5cf6"/>`),
  'monitor.svg': wrap('mon', 'Ilustración referencial de monitor', '#0c4a6e', '#0284c7', `
    <rect x="180" y="150" width="440" height="260" rx="14" fill="#0b1220"/>
    <rect x="198" y="168" width="404" height="224" rx="7" fill="url(#screen-mon)"/>
    <path d="M240 350l80-104 62 70 78-116 92 150z" fill="#38bdf8" opacity=".18"/>
    <rect x="370" y="410" width="60" height="46" fill="#94a3b8"/>
    <rect x="300" y="456" width="200" height="16" rx="8" fill="#cbd5e1"/>
    <circle cx="654" cy="190" r="34" fill="#38bdf8" opacity=".14"/>
    <path d="M640 190a14 14 0 1 1 28 0 14 14 0 0 1-28 0Z" fill="none" stroke="#7dd3fc" stroke-width="3"/>
    <path d="M640 226h28" stroke="#7dd3fc" stroke-width="3" stroke-linecap="round"/>`),
  'components.svg': wrap('com', 'Ilustración referencial de componentes', '#78350f', '#b45309', `
    <rect x="250" y="160" width="300" height="280" rx="18" fill="#0b1220" stroke="#475569" stroke-width="2"/>
    <rect x="286" y="196" width="228" height="160" rx="8" fill="#111827"/>
    <rect x="306" y="216" width="80" height="48" rx="4" fill="#f59e0b" opacity=".55"/>
    <rect x="414" y="216" width="80" height="48" rx="4" fill="#fbbf24" opacity=".35"/>
    <rect x="306" y="286" width="188" height="10" rx="5" fill="#334155"/>
    <rect x="306" y="308" width="130" height="10" rx="5" fill="#334155"/>
    <path d="M250 220h-34v40h34M550 220h34v40h-34M250 340h-34v-40h34M550 340h34v-40h-34" fill="none" stroke="#f59e0b" stroke-width="4"/>
    <circle cx="400" cy="392" r="30" fill="#f59e0b" opacity=".12"/>
    <path d="M400 376v32M384 392h32" stroke="#fbbf24" stroke-width="4" stroke-linecap="round"/>`),
  'peripherals.svg': wrap('per', 'Ilustración referencial de periféricos', '#831843', '#db2777', `
    <rect x="190" y="300" width="380" height="130" rx="18" fill="#0b1220" stroke="#475569"/>
    ${Array.from({ length: 8 }, (_, i) => `<rect x="${216 + i * 43}" y="326" width="30" height="24" rx="5" fill="#ec4899" opacity="${0.2 + (i % 3) * 0.12}"/>`).join('')}
    <rect x="216" y="366" width="230" height="24" rx="6" fill="#334155"/>
    <rect x="456" y="366" width="86" height="24" rx="6" fill="#334155"/>
    <path d="M604 210c34 0 62 28 62 62v70h-124v-70c0-34 28-62 62-62Z" fill="#0b1220" stroke="#475569"/>
    <circle cx="604" cy="278" r="22" fill="#ec4899" opacity=".55"/>
    <path d="M604 300v22" stroke="#ec4899" stroke-width="4" stroke-linecap="round"/>
    <circle cx="214" cy="238" r="34" fill="#0b1220" stroke="#475569"/>
    <circle cx="214" cy="238" r="8" fill="#f472b6"/>`),
  'network.svg': wrap('net', 'Ilustración referencial de redes', '#064e3b', '#059669', `
    <rect x="300" y="360" width="200" height="70" rx="14" fill="#0b1220" stroke="#475569"/>
    <circle cx="340" cy="395" r="7" fill="#34d399"/><circle cx="368" cy="395" r="7" fill="#34d399" opacity=".4"/>
    <path d="M420 380h56" stroke="#475569" stroke-width="4" stroke-linecap="round"/>
    <path d="M400 360V240" stroke="#34d399" stroke-width="3" opacity=".6"/>
    <path d="M400 300c-70 0-110-36-110-86M400 300c70 0 110-36 110-86" fill="none" stroke="#34d399" stroke-width="4" stroke-linecap="round" stroke-dasharray="6 10" opacity=".55"/>
    <path d="M262 176a46 46 0 0 1 78 0M292 212a26 26 0 0 1 32 0" fill="none" stroke="#6ee7b7" stroke-width="5" stroke-linecap="round"/>
    <path d="M510 176a46 46 0 0 1 78 0M540 212a26 26 0 0 1 32 0" fill="none" stroke="#6ee7b7" stroke-width="5" stroke-linecap="round"/>
    <circle cx="400" cy="222" r="20" fill="#34d399" opacity=".14"/>
    <circle cx="400" cy="222" r="7" fill="#6ee7b7"/>`),
  'accessories.svg': wrap('acc', 'Ilustración referencial de accesorios', '#701a75', '#c026d3', `
    <path d="M250 230v-20a150 150 0 0 1 300 0v20" fill="none" stroke="#e879f9" stroke-width="12" opacity=".5"/>
    <rect x="210" y="220" width="72" height="150" rx="30" fill="#0b1220" stroke="#475569" stroke-width="2"/>
    <rect x="518" y="220" width="72" height="150" rx="30" fill="#0b1220" stroke="#475569" stroke-width="2"/>
    <rect x="230" y="244" width="32" height="100" rx="16" fill="#c026d3" opacity=".3"/>
    <rect x="538" y="244" width="32" height="100" rx="16" fill="#c026d3" opacity=".3"/>
    <rect x="392" y="390" width="16" height="70" rx="8" fill="#c026d3" opacity=".5"/>
    <circle cx="400" cy="478" r="42" fill="#0b1220" stroke="#475569"/>
    <circle cx="400" cy="478" r="14" fill="#e879f9" opacity=".55"/>`)
};

for (const [name, svg] of Object.entries(files)) {
  fs.writeFileSync(path.join(dir, name), svg, 'utf8');
}
console.log('Placeholders:', Object.keys(files).join(', '));
