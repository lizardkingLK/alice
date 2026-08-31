import { Badge } from '@repo/ui/components/ui/badge';
import { CardTitle } from '@repo/ui/components/ui/card';
import { DialogTitle } from '@repo/ui/components/ui/dialog';
import { integrationExternalHref } from '@/app/settings/_components/settings-integration-catalog';
import {
  IntegrationInitialsLink,
  IntegrationWebsiteLink,
} from '@/app/settings/_components/settings-integration-initials-link';

type IntegrationIdentityProps = {
  readonly name: string;
  readonly websiteUrl: string;
  readonly variant: 'card' | 'dialog';
  readonly statusLabel?: string;
};

/** Shared marketplace card / detail dialog identity block. */
export function IntegrationIdentity({
  name,
  websiteUrl,
  variant,
  statusLabel,
}: Readonly<IntegrationIdentityProps>) {
  const href = integrationExternalHref(websiteUrl);
  const avatarSize = variant === 'card' ? 'md' : 'lg';

  if (variant === 'card') {
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base font-semibold">{name}</CardTitle>
          <IntegrationWebsiteLink
            href={href}
            label={websiteUrl}
            className="mt-1"
          />
        </div>
        <IntegrationInitialsLink name={name} href={href} size={avatarSize} />
      </div>
    );
  }

  return (
    <div className="flex items-start gap-4">
      <IntegrationInitialsLink name={name} href={href} size={avatarSize} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <DialogTitle className="text-left">{name}</DialogTitle>
          {statusLabel ? (
            <Badge variant="secondary" className="shrink-0">
              {statusLabel}
            </Badge>
          ) : null}
        </div>
        <IntegrationWebsiteLink href={href} label={websiteUrl} />
      </div>
    </div>
  );
}

export function IntegrationHighlightsList({
  highlights,
}: Readonly<{ highlights: readonly string[] }>) {
  return (
    <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
      {highlights.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}
