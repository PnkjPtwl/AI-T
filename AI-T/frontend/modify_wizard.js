const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'app/(manager)/scenarios/new/page.tsx');
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/{ num: 4, label: 'Avatar' },\s*/, '');
code = code.replace(/{ num: 5, label: 'Questions' }/, "{ num: 4, label: 'Questions' }");
code = code.replace(/{ num: 6, label: 'Review' }/, "{ num: 5, label: 'Review' }");
code = code.replace(/idx < 5/g, 'idx < 4');

const avatarRegex = /\{\/\* ── STEP 4: AVATAR ──.*?\{\/\* ── STEP 5: QUESTIONS ──/s;
code = code.replace(avatarRegex, '{/* ── STEP 4: QUESTIONS ──');

code = code.replace(/step === 5 && \(/g, 'step === 4 && (');

const reviewRegex = /\{\/\* ── STEP 6: REVIEW & PUBLISH ──.*?step === 6 && \(/s;
code = code.replace(reviewRegex, '{/* ── STEP 5: REVIEW & PUBLISH ────────────────────────────────────────────── */}\n      {step === 5 && (');

code = code.replace(/step < 6 \? \(/g, 'step < 5 ? (');

fs.writeFileSync(file, code);
console.log('Done!');
