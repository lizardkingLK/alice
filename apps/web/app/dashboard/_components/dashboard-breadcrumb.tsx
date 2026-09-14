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
import { isUuidSegment, toShortId } from '@/app/_shared/utility';

export type DashboardBreadcrumbOverride = {
  label: string;
  url: string;
};

type DashboardBreadcrumbProps = {
  overrides?: DashboardBreadcrumbOverride[];
  /**
   * When true, `overrides` is the complete crumb list (not path label overlays).
   * Use this when the trail must differ from the URL (e.g. project-scoped work item).
   */
  asTrail?: boolean;
};

const DEFAULT_OVERRIDES: DashboardBreadcrumbOverride[] = [
  { label: 'Dashboard', url: '/dashboard' },
];

/** Cap long entity names in the header trail; short labels stay intact. */
const BREADCRUMB_LABEL_MAX_CHARS = 20;

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

/**
 * Path UUIDs fall back to short-id when no name override is provided (e.g.
 * `loading.tsx` before the page resolves entity titles).
 */
function labelForSegment(segment: string): string {
  if (isUuidSegment(segment)) {
    return toShortId(segment);
  }
  return humanizeSegment(segment);
}

function truncateBreadcrumbLabel(label: string): {
  display: string;
  title?: string;
} {
  if (label.length <= BREADCRUMB_LABEL_MAX_CHARS) {
    return { display: label };
  }

  return {
    display: `${label.slice(0, BREADCRUMB_LABEL_MAX_CHARS)}...`,
    title: label,
  };
}

function BreadcrumbLabel({ label }: Readonly<{ label: string }>) {
  const { display, title } = truncateBreadcrumbLabel(label);
  return <span title={title}>{display}</span>;
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
      label: override?.label ?? labelForSegment(segment),
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

/**
 * Build crumbs from the URL path, applying optional per-segment label overrides.
 */
export function resolveDashboardBreadcrumbItems(
  pathname: string,
  overrides: DashboardBreadcrumbOverride[] = DEFAULT_OVERRIDES
): DashboardBreadcrumbOverride[] {
  return buildBreadcrumbItems(pathname, overrides);
}

/** Use an explicit crumb list as the trail (ignore path-derived crumbs). */
export function resolveDashboardBreadcrumbTrail(
  overrides: DashboardBreadcrumbOverride[] = DEFAULT_OVERRIDES
): DashboardBreadcrumbOverride[] {
  return overrides;
}

export function DashboardBreadcrumb({
  overrides = DEFAULT_OVERRIDES,
  asTrail = false,
}: Readonly<DashboardBreadcrumbProps>) {
  const pathname = usePathname();
  const items = asTrail
    ? resolveDashboardBreadcrumbTrail(overrides)
    : resolveDashboardBreadcrumbItems(pathname, overrides);

  return (
    <Breadcrumb className="max-w-full min-w-0">
      <BreadcrumbList className="min-w-0 flex-nowrap items-center overflow-hidden">
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;

          return (
            <Fragment key={`${item.url}-${item.label}`}>
              {index > 0 ? (
                <BreadcrumbSeparator className="shrink-0 self-center" />
              ) : null}
              <BreadcrumbItem className="shrink-0">
                {isCurrent || item.url === '#' ? (
                  <BreadcrumbPage>
                    <BreadcrumbLabel label={item.label} />
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={item.url}>
                      <BreadcrumbLabel label={item.label} />
                    </Link>
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
