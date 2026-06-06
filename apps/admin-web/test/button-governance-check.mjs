import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const files = [
  'src/features/permissions/PermissionManagementView.tsx',
  'src/features/applications/ApplicationDetailSheet.tsx',
  'src/features/settings/SystemSettingsView.tsx',
  'src/features/records/RecordQueryView.tsx',
  'src/features/org-browser/org-browser.tsx',
  'src/features/org-browser/org-user-selector.tsx'
];
const failures = [];

const buttonSource = fs.readFileSync(path.join(root, 'src/components/ui/button.tsx'), 'utf8');
if (!buttonSource.includes('whitespace-nowrap')) {
  failures.push('src/components/ui/button.tsx: Button base class must include whitespace-nowrap');
}

for (const relative of files) {
  const text = fs.readFileSync(path.join(root, relative), 'utf8');
  const buttonTags = text.match(/<Button\b[\s\S]*?>/g) ?? [];

  for (const tag of buttonTags) {
    if (!tag.includes('size="icon"')) {
      continue;
    }

    const line = lineNumberFor(text, tag);
    if (!tag.includes('aria-label=')) {
      failures.push(`${relative}:${line} icon button must have aria-label`);
    }
    if (!tag.includes('title=')) {
      failures.push(`${relative}:${line} icon button must have title`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('button governance check passed');

function lineNumberFor(text, needle) {
  const index = text.indexOf(needle);
  if (index < 0) {
    return 1;
  }
  return text.slice(0, index).split('\n').length;
}
