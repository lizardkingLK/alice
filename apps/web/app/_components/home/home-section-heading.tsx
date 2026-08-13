type HomeSectionHeadingProps = {
  readonly eyebrow: string;
  readonly headingId: string;
  readonly title: string;
  readonly description: string;
};

export function HomeSectionHeading({
  eyebrow,
  headingId,
  title,
  description,
}: Readonly<HomeSectionHeadingProps>) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-primary text-sm font-medium tracking-wide">
        {eyebrow}
      </p>
      <h2
        id={headingId}
        className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
      >
        {title}
      </h2>
      <p className="text-muted-foreground mt-3 text-base text-pretty sm:text-lg">
        {description}
      </p>
    </div>
  );
}
