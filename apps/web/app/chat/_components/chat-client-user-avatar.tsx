import { UserAvatar } from '@/components/user-avatar';

export default function ChatUserAvatar({
  name,
  imageUrl,
}: Readonly<{
  name?: string | null;
  imageUrl?: string | null;
}>) {
  return (
    <UserAvatar
      name={name}
      imageUrl={imageUrl}
      className="size-8 shrink-0"
      fallbackClassName="text-[10px]"
    />
  );
}
