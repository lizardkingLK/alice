import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = path.join(__dirname, '..');

const registryFiles = [
  { json: 'separator', out: 'src/components/ui/separator.tsx' },
  { json: 'skeleton', out: 'src/components/ui/skeleton.tsx' },
  { json: 'breadcrumb', out: 'src/components/ui/breadcrumb.tsx' },
  { json: 'sheet-registry', out: 'src/components/ui/sheet.tsx' },
  { json: 'tooltip-registry', out: 'src/components/ui/tooltip.tsx' },
  { json: 'use-mobile-registry', out: 'src/hooks/use-mobile.ts' },
  { json: 'sidebar-registry', out: 'src/components/ui/sidebar.tsx' },
];

function transform(content, fileName) {
  let result = content
    .replaceAll('@/registry/radix-nova/lib/utils', '@repo/ui/lib/utils')
    .replaceAll('@/registry/radix-nova/ui/', '@repo/ui/components/ui/')
    .replaceAll('@/registry/radix-nova/hooks/', '@repo/ui/hooks/');

  if (fileName.includes('breadcrumb')) {
    result = `import { ChevronRight, MoreHorizontal } from 'lucide-react';\n\n${result}`;
    result = result.replace(
      /import \{ IconPlaceholder \} from "@\/app\/\(create\)\/components\/icon-placeholder"\n\n/,
      ''
    );
    result = result.replace(
      /children \?\? \(\s*<IconPlaceholder[\s\S]*?\/>\s*\)/,
      'children ?? <ChevronRight />'
    );
    result = result.replace(
      /<IconPlaceholder[\s\S]*?remixicon="RiMoreLine"\s*\/>\s*More\s*/,
      '<MoreHorizontal />\n      <span className="sr-only">More</span>'
    );
  }

  if (fileName.includes('sidebar')) {
    result = `import { PanelLeft } from 'lucide-react';\n\n${result}`;
    result = result.replace(
      /import \{ IconPlaceholder \} from "@\/app\/\(create\)\/components\/icon-placeholder"\n\n/,
      ''
    );
    result = result.replace(
      /<IconPlaceholder[\s\S]*?className="cn-rtl-flip"\s*\/>/,
      '<PanelLeft className="cn-rtl-flip" />'
    );
  }

  if (fileName.includes('skeleton') && !result.includes('import * as React')) {
    result = `import * as React from 'react';\n\n${result}`;
  }

  return result
    .replaceAll('"', "'")
    .replaceAll("'use client'", '"use client"');
}

for (const { json, out } of registryFiles) {
  const jsonPath = path.join(base, `${json}.json`);
  const registry = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const file = registry.files[0];
  const content = transform(file.content, out);
  const outPath = path.join(base, out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content);
  console.log('Wrote', out);
}
