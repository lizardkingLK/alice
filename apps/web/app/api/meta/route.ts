import { NextRequest, NextResponse } from 'next/server';

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '\u2019',
  lsquo: '\u2018',
  rdquo: '\u201D',
  ldquo: '\u201C',
  ndash: '\u2013',
  mdash: '\u2014',
  hellip: '\u2026',
};

/** Decode common HTML entities from OG / title meta content for plain-text display. */
function decodeHtmlEntities(value: string): string {
  return value
    .replaceAll(/&#x([0-9a-fA-F]+);/g, (match, hex: string) => {
      const codePoint = Number.parseInt(hex, 16);
      return Number.isFinite(codePoint)
        ? String.fromCodePoint(codePoint)
        : match;
    })
    .replaceAll(/&#(\d+);/g, (match, dec: string) => {
      const codePoint = Number.parseInt(dec, 10);
      return Number.isFinite(codePoint)
        ? String.fromCodePoint(codePoint)
        : match;
    })
    .replaceAll(/&([a-zA-Z]+);/g, (match, name: string) => {
      return NAMED_HTML_ENTITIES[name.toLowerCase()] ?? match;
    });
}

function readMetaContent(html: string, property: string): string | null {
  const metaPatternA = new RegExp(
    `<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`,
    'i'
  );
  const metaPatternB = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["']`,
    'i'
  );

  const match = metaPatternA.exec(html) || metaPatternB.exec(html);
  return match?.[1] ? decodeHtmlEntities(match[1]) : null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing URL' }, { status: 400 });
  }

  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'bot' } });
    const html = await response.text();
    const titleMatch = /<title>([^<]*)<\/title>/i.exec(html);
    const pageTitle = titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1]) : '';

    return NextResponse.json({
      title: readMetaContent(html, 'og:title') || pageTitle || '',
      description: readMetaContent(html, 'og:description') || '',
      image: readMetaContent(html, 'og:image') || undefined,
      siteName: readMetaContent(html, 'og:site_name') || undefined,
    });
  } catch {
    return NextResponse.json({ title: url, description: '' });
  }
}
