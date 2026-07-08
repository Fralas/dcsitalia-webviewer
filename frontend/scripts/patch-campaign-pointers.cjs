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

content = content.replace('const OUTWARD_PX = 22;', 'const OUTWARD_PX = 52;');
content = content.replace('const ARM_PX = 8;', 'const ARM_PX = 22;');
content = content.replace('const FADE_OUT_STEP = 0.14;', 'const FADE_OUT_STEP = 0.14;\nconst DOT_RADIUS = 5;');

content = content.replace(
  'return Math.min(120, Math.max(36, Math.round(text.length * 6.5)));',
  'return Math.min(160, Math.max(48, Math.round(text.length * 8.5)));',
);

content = content.replace(
  'buildPointerTargets(globe, container, CAMPAIGNS)',
  'buildPointerTargets(globe, container, POINTER_CAMPAIGNS)',
);

content = content.replace('const SMOOTHING = 0.12;\nconst MAX_STEP_PX = 22;\n', '');

content = content.replace(
  /function smoothPoint[\s\S]*?^}\n\nfunction smoothPointerFrame[\s\S]*?^}/m,
  `function applyPointerOpacity(previous, targets) {
  const targetById = new Map(targets.map((entry) => [entry.campaign.id, entry]));
  const next = [];
  const seen = new Set();

  targetById.forEach((target, id) => {
    seen.add(id);
    const prev = previous.get(id);
    const opacity = Math.min(1, (prev?.opacity ?? 0) + FADE_IN_STEP);
    const frame = { ...target, opacity };
    previous.set(id, frame);
    next.push(frame);
  });

  previous.forEach((prev, id) => {
    if (seen.has(id)) return;
    const opacity = Math.max(0, (prev.opacity ?? 1) - FADE_OUT_STEP);
    if (opacity <= 0.02) {
      previous.delete(id);
      return;
    }
    const faded = { ...prev, opacity };
    previous.set(id, faded);
    next.push(faded);
  });

  return next;
}`,
);

content = content.replace(
  'const next = smoothPointerFrame(smoothedRef.current, targets);',
  'const next = applyPointerOpacity(smoothedRef.current, targets);',
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
