'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@repo/ui/components/ui/breadcrumb';

export type DashboardBreadcrumbOverride = {
  label: string;
  url: string;
};

type DashboardBreadcrumbProps = {
  overrides?: DashboardBreadcrumbOverride[];
};

const DEFAULT_OVERRIDES: DashboardBreadcrumbOverride[] = [
  { label: 'Dashboard', url: '/dashboard' },
];

function normalizeUrl(url: string): string {
  if (url.length > 1 && url.endsWith('/')) {
    return url.slice(0, -1);
  }

  return url || '/';
}

function humanizeSegment(segment: string): string {
  return segment
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildBreadcrumbItems(
  pathname: string,
  overrides: DashboardBreadcrumbOverride[]
): DashboardBreadcrumbOverride[] {
  const segments = pathname.split('/').filter(Boolean);
  const overrideByUrl = new Map(
    overrides.map((item) => [normalizeUrl(item.url), item] as const)
  );
  const overrideBySegment = new Map(
    overrides.map((item) => {
      const segment = normalizeUrl(item.url).split('/').findLast(Boolean);
      return [segment ?? '', item] as const;
    })
  );

  const items: DashboardBreadcrumbOverride[] = [];
  let accumulated = '';

  for (const segment of segments) {
    accumulated += `/${segment}`;
    const override =
      overrideByUrl.get(accumulated) ?? overrideBySegment.get(segment);

    items.push({
      label: override?.label ?? humanizeSegment(segment),
      url: override?.url ?? accumulated,
    });
  }

  const rootOverride =
    overrideByUrl.get('/dashboard') ?? overrides[0] ?? DEFAULT_OVERRIDES[0];

  if (rootOverride && items[0]?.url !== rootOverride.url) {
    items.unshift(rootOverride);
  }

  return items;
}

export function DashboardBreadcrumb({
  overrides = DEFAULT_OVERRIDES,
}: Readonly<DashboardBreadcrumbProps>) {
  const pathname = usePathname();
  const items = buildBreadcrumbItems(pathname, overrides);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;

          return (
            <Fragment key={`${item.url}-${item.label}`}>
              {index > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem>
                {isCurrent ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={item.url}>{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
