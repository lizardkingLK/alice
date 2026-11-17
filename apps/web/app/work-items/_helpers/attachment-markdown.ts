/**
 * Notes (and similar) export the note title as a leading ATX `#` heading.
 * Split that off so the preview can style it as document chrome, distinct
 * from `#` headings inside the body.
 */
export function splitMarkdownDocumentTitle(markdown: string): {
  readonly documentTitle: string | null;
  readonly body: string;
} {
  if (markdown.length < 3 || markdown[0] !== '#' || markdown[1] === '#') {
    return { documentTitle: null, body: markdown };
  }

  let index = 1;
  while (
    index < markdown.length &&
    (markdown[index] === ' ' || markdown[index] === '\t')
  ) {
    index += 1;
  }
  if (index === 1) {
    return { documentTitle: null, body: markdown };
  }

  const titleStart = index;
  while (index < markdown.length && markdown[index] !== '\n') {
    index += 1;
  }

  const documentTitle = markdown.slice(titleStart, index).trimEnd();
  if (!documentTitle) {
    return { documentTitle: null, body: markdown };
  }

  while (index < markdown.length && markdown[index] === '\n') {
    index += 1;
  }

  return {
    documentTitle,
    body: markdown.slice(index),
  };
}
