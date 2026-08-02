import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocsArticle } from '@/app/docs/_components/docs-article';
import {
  DocsPageFrame,
  DOCS_ROBOTS,
} from '@/app/docs/_components/docs-page-frame';
import { docHref, getDocBySlug, getDocsIndex } from '@/app/docs/_lib/docs';

type DocsSlugPageProps = {
  readonly params: Promise<{ slug: string[] }>;
};

export async function generateStaticParams() {
  return getDocsIndex()
    .filter((entry) => entry.slug !== 'index')
    .map((entry) => ({
      slug: entry.slug.split('/'),
    }));
}

export async function generateMetadata({
  params,
}: DocsSlugPageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  return {
    title: doc ? `${doc.entry.title} · Docs` : 'Docs',
    robots: DOCS_ROBOTS,
  };
}

export default async function DocsSlugPage({ params }: DocsSlugPageProps) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  if (!doc) {
    notFound();
  }

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
      />
    </DocsPageFrame>
  );
}
