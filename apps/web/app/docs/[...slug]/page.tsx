import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocsArticle } from '@/app/docs/_components/docs-article';
import {
  DocsPageFrame,
  DOCS_ROBOTS,
} from '@/app/docs/_components/docs-page-frame';
import { docHref, getDocBySlug, getDocsSections } from '@/app/docs/_lib/docs';
import { flattenDocsEntries, getAdjacentDocs } from '@/lib/docs/docs-shared';

export const dynamic = 'force-dynamic';

type DocsSlugPageProps = {
  readonly params: Promise<{ slug: string[] }>;
};

export async function generateMetadata({
  params,
}: DocsSlugPageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getDocBySlug(slug);
  return {
    title: doc ? `${doc.entry.title} · Docs` : 'Docs',
    robots: DOCS_ROBOTS,
  };
}

export default async function DocsSlugPage({ params }: DocsSlugPageProps) {
  const { slug } = await params;
  const doc = await getDocBySlug(slug);
  if (!doc) {
    notFound();
  }

  const sections = await getDocsSections();
  const { previous, next } = getAdjacentDocs(
    doc.entry.slug,
    flattenDocsEntries(sections)
  );

  return (
    <DocsPageFrame
      breadcrumbOverrides={[
        { label: 'Docs', url: '/docs' },
        {
          label: doc.entry.title,
          url: docHref(doc.entry.slug),
        },
      ]}
      breadcrumbAsTrail
    >
      <DocsArticle
        title={doc.entry.title}
        section={doc.entry.section}
        slug={doc.entry.slug}
        markdown={doc.markdown}
        previous={previous}
        next={next}
      />
    </DocsPageFrame>
  );
}
