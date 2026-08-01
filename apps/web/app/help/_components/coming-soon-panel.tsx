type ComingSoonPanelProps = {
  readonly title: string;
};

export function ComingSoonPanel({ title }: ComingSoonPanelProps) {
  return (
    <div className="border-border bg-muted/30 flex max-w-lg flex-col gap-2 rounded-lg border p-6">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-muted-foreground text-sm">
        This section will be available in the future.
      </p>
    </div>
  );
}
