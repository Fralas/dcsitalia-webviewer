const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..', '..');
const target = path.join(repo, 'frontend/src/components/landing/CampaignPointers.jsx');

let content = execSync(
  'git show 77f4e26:frontend/src/components/landing/CampaignPointers.jsx',
  { cwd: repo, encoding: 'utf8' },
);

content = content.replace(
  "import { CAMPAIGNS } from '../../config/campaigns';",
  `import { CAMPAIGNS } from '../../config/campaigns';

const POINTER_CAMPAIGNS = CAMPAIGNS.filter((campaign) => campaign.showPointer !== false);`,
);

content = content.replace('const OUTWARD_PX = 22;', 'const OUTWARD_PX = 34;');
content = content.replace('const ARM_PX = 8;', 'const ARM_PX = 14;');
content = content.replace('const FADE_OUT_STEP = 0.14;', 'const FADE_OUT_STEP = 0.14;\nconst DOT_RADIUS = 5;');

content = content.replace(
  'return Math.min(120, Math.max(36, Math.round(text.length * 6.5)));',
  'return Math.min(160, Math.max(48, Math.round(text.length * 8.5)));',
);

content = content.replace(
  'buildPointerTargets(globe, container, CAMPAIGNS)',
  'buildPointerTargets(globe, container, POINTER_CAMPAIGNS)',
);

content = content.replace(/\s+r=\{3\}/, '\n                r={DOT_RADIUS}');

fs.writeFileSync(target, content.replace(/^\uFEFF/, ''), 'utf8');

const head = fs.readFileSync(target);
if (head[1] === 0) {
  throw new Error('File still UTF-16');
}

require('@babel/parser').parse(head.toString('utf8'), {
  sourceType: 'module',
  plugins: ['jsx'],
});

console.log('CampaignPointers.jsx written OK');
