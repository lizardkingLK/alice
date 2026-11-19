import { cn } from '@repo/ui/lib/utils';

type HomeCoverBannerProps = {
  readonly coverUrl: string | null;
};

/** Read-only cover strip for the signed-in home launchpad. */
export function HomeCoverBanner({ coverUrl }: Readonly<HomeCoverBannerProps>) {
  return (
    <div
      className={cn(
        'relative h-48 w-full shrink-0 overflow-hidden sm:h-56 md:h-64',
        !coverUrl && 'bg-primary'
      )}
    >
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- public Storage URL
        <img
          src={coverUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
    </div>
  );
}
