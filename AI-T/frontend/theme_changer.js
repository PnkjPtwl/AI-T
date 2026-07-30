const fs = require('fs');

const files = [
  'app/(manager)/coaching/page.tsx',
  'app/(manager)/team/page.tsx',
  'app/(manager)/reps/[repId]/page.tsx',
  'app/(manager)/analytics/page.tsx'
];

const replacements = {
  'bg-[#EFE7DC]': 'bg-white',
  'bg-[#F6F1E8]': 'bg-[#F8FAFC]',
  'bg-[#EAE2D6]': 'bg-[#F1F5F9]',
  'border-[#D8CCBC]': 'border-[#E2E8F0]',
  'text-[#3A2F28]': 'text-[#1A2A3A]',
  'text-[#7B6F63]': 'text-[#64748B]',
  'text-[#7D8461]': 'text-green-600',
  'bg-[#7D8461]': 'bg-[#2C5282]', // Using blue for primary actions
  'hover:bg-[#6B7252]': 'hover:bg-[#1A365D]',
  'text-[#A06A5B]': 'text-red-500',
  'bg-[#A06A5B]': 'bg-red-500',
  'text-[#D8CCBC]': 'text-[#CBD5E0]',
  'bg-[#D6C2A8]': 'bg-yellow-400',
  'border-[#A06A5B]': 'border-red-500',
  'border-[#7D8461]': 'border-green-600',
  'stroke=\"#7D8461\"': 'stroke=\"#2C5282\"',
  'fill=\"#7D8461\"': 'fill=\"#2C5282\"',
  'stroke=\"#7B6F63\"': 'stroke=\"#64748B\"',
  'stroke=\"#D8CCBC\"': 'stroke=\"#E2E8F0\"',
  'text-[#F6F1E8]': 'text-white' // since primary bg is blue, text should be white
};

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    for (const [key, value] of Object.entries(replacements)) {
      content = content.split(key).join(value);
    }
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  } else {
    console.log(`File not found: ${file}`);
  }
});
