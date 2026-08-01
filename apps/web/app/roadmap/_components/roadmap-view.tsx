import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import {
  ROADMAP_NEAR_TERM,
  ROADMAP_SECTIONS,
} from '@/app/roadmap/_data/roadmap';

export function RoadmapView() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Near-term priority
        </h2>
        <ol className="text-muted-foreground list-decimal space-y-2 pl-5 text-sm">
          {ROADMAP_NEAR_TERM.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>

      {ROADMAP_SECTIONS.map((section) => (
        <section key={section.id} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold tracking-tight">
              {section.title}
            </h2>
            <p className="text-muted-foreground text-sm">{section.summary}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {section.items.map((item) => (
              <Card key={item.title} size="sm">
                <CardHeader>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      ))}

      <p className="text-muted-foreground text-xs">
        Full plan: docs/product/ROADMAP.md
      </p>
    </div>
  );
}
