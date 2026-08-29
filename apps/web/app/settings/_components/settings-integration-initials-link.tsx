import { ExternalLink } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { getInitials } from '@/app/_shared/utility';

/** Two-letter initials for integration marketplace avatars. */
export function integrationInitials(name: string): string {
  const initials = getInitials(name);
  if (initials.length >= 2) {
    return initials;
  }

  const trimmed = name.trim();
  return trimmed.slice(0, 2).toUpperCase() || '?';
}

const EXTERNAL_LINK_PROPS = {
  target: '_blank',
  rel: 'noopener noreferrer',
} as const;

const INITIALS_LINK_SIZE_CLASS = {
  sm: 'size-10 text-xs',
  md: 'size-12 text-sm',
  lg: 'size-14 text-base',
} as const;

type IntegrationInitialsLinkProps = {
  readonly name: string;
  readonly href: string;
  readonly size?: keyof typeof INITIALS_LINK_SIZE_CLASS;
  readonly className?: string;
};

/** Initials avatar that opens the integration website or docs in a new tab. */
export function IntegrationInitialsLink({
  name,
  href,
  size = 'md',
  className,
}: Readonly<IntegrationInitialsLinkProps>) {
  return (
    <a
      href={href}
      {...EXTERNAL_LINK_PROPS}
      title={`Visit ${name}`}
      className={cn(
        'bg-muted text-foreground hover:bg-muted/80 inline-flex shrink-0 items-center justify-center rounded-xl font-semibold tracking-tight transition-colors',
        INITIALS_LINK_SIZE_CLASS[size],
        className
      )}
    >
      {integrationInitials(name)}
    </a>
  );
}

type IntegrationWebsiteLinkProps = {
  readonly href: string;
  readonly label: string;
  readonly className?: string;
};

/** External website link with icon for integration cards and dialogs. */
export function IntegrationWebsiteLink({
  href,
  label,
  className,
}: Readonly<IntegrationWebsiteLinkProps>) {
  return (
    <a
      href={href}
      {...EXTERNAL_LINK_PROPS}
      className={cn(
        'text-muted-foreground hover:text-foreground inline-flex max-w-full items-center gap-1 text-sm',
        className
      )}
    >
      <span className="truncate">{label}</span>
      <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
    </a>
  );
}
