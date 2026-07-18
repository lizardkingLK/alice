import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing URL' }, { status: 400 });
  }

  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'bot' } });
    const html = await response.text();
    const getMeta = (property: string) => {
      const metaPatternA = new RegExp(
        `<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`,
        'i'
      );
      const metaPatternB = new RegExp(
        `<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["']`,
        'i'
      );

      const match = metaPatternA.exec(html) || metaPatternB.exec(html);
      return match ? match[1] : null;
    };

    const metaTitlePattern = new RegExp(/<title>([^<]*)<\/title>/i);

    return NextResponse.json({
      title: getMeta('og:title') || metaTitlePattern.exec(html)?.[1] || '',
      description: getMeta('og:description') || '',
      image: getMeta('og:image') || undefined,
      siteName: getMeta('og:site_name') || undefined,
    });
  } catch {
    return NextResponse.json({ title: url, description: '' });
  }
}
