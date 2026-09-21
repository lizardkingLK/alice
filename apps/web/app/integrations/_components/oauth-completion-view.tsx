'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@repo/ui/components/ui/button';
import { Badge } from '@repo/ui/components/ui/badge';
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
} from '@repo/ui/lib/icons';
import {
  createOAuthCompletionMessage,
  notifyOAuthCompletion,
  parseOAuthCompletionStatus,
  IntegrationOAuthProvider,
  OAuthCompletionStatus,
} from '@/app/integrations/_types/oauth-completion.types';

type StatusConfig = {
  title: string;
  badgeLabel: string;
  badgeClass: string;
  // eslint-disable-next-line no-unused-vars
  icon: (props: { className?: string }) => ReactNode;
  iconClass: string;
  // eslint-disable-next-line no-unused-vars
  description: (providerName: string, errorDetail?: string | null) => string;
  buttonVariant: 'default' | 'outline';
};

const STATUS_CONFIG_MAP: Record<OAuthCompletionStatus, StatusConfig> = {
  [OAuthCompletionStatus.Connected]: {
    title: 'Connected Successfully',
    badgeLabel: 'Connected',
    badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600',
    icon: CheckCircle2,
    iconClass: 'text-emerald-500',
    description: (provider) =>
      `Your ${provider} account has been connected to Alice. You can close this window to return to your project.`,
    buttonVariant: 'default',
  },
  [OAuthCompletionStatus.Denied]: {
    title: 'Authentication Cancelled',
    badgeLabel: 'Cancelled',
    badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-600',
    icon: AlertCircle,
    iconClass: 'text-amber-500',
    description: (provider) =>
      `The ${provider} authorization was cancelled or denied. You can close this window and try again from Alice.`,
    buttonVariant: 'outline',
  },
  [OAuthCompletionStatus.Error]: {
    title: 'Connection Failed',
    badgeLabel: 'Failed',
    badgeClass: 'border-destructive/30 bg-destructive/10 text-destructive',
    icon: XCircle,
    iconClass: 'text-destructive',
    description: (provider, detail) =>
      detail ||
      `Something went wrong finishing ${provider} authentication. Please close this window and try again.`,
    buttonVariant: 'outline',
  },
};

export interface OAuthCompletionViewProps {
  provider: IntegrationOAuthProvider;
  providerName: string;
  logo: ReactNode;
  searchParamKey: string;
}

export function OAuthCompletionView({
  provider,
  providerName,
  logo,
  searchParamKey,
}: Readonly<OAuthCompletionViewProps>) {
  const searchParams = useSearchParams();
  const rawStatus =
    searchParams.get(searchParamKey) || searchParams.get('status');
  const errorDetail = searchParams.get('error');

  const status = parseOAuthCompletionStatus(rawStatus);
  const config = STATUS_CONFIG_MAP[status];
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // Notify the opener and same-origin tabs immediately using utcNow timestamp
    const message = createOAuthCompletionMessage(provider, status, errorDetail);
    notifyOAuthCompletion(message);
  }, [provider, status, errorDetail]);

  const handleClose = () => {
    setIsClosing(true);
    window.close();
  };

  const IconComponent = config.icon;

  return (
    <main className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <div className="border-border bg-card animate-in fade-in zoom-in-95 flex w-full max-w-md flex-col items-center gap-4 rounded-xl border p-8 text-center shadow-lg duration-300">
        <div className="relative flex items-center justify-center">
          <div className="bg-muted/40 flex size-14 items-center justify-center rounded-2xl border p-3">
            {logo}
          </div>
          <div className="bg-card absolute -right-1 -bottom-1 rounded-full p-0.5 shadow-sm">
            <IconComponent className={`size-5 ${config.iconClass}`} />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">{config.title}</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            {config.description(providerName, errorDetail)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-xs ${config.badgeClass}`}>
            {config.badgeLabel}
          </Badge>
        </div>

        <div className="w-full pt-2">
          <Button
            type="button"
            variant={config.buttonVariant}
            className={`w-full ${
              status === OAuthCompletionStatus.Connected
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : ''
            }`}
            onClick={handleClose}
          >
            {isClosing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Closing...
              </>
            ) : (
              'Close Window'
            )}
          </Button>
        </div>
      </div>
    </main>
  );
}
