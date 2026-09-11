/**
 * Shared dynamic field utilities for extracting values from work-item descriptions
 * (both TipTap JSON doc.attrs.dynamicFields and text marker fallbacks), patching values,
 * and identifying work items that have values configured for specific field keys.
 */

export function parseTextDynamicFields(text: string): Record<string, unknown> {
  const marker = '[Dynamic Fields]';
  const markerIndex = text.indexOf(marker);
  if (markerIndex === -1) {
    return {};
  }

  const remainder = text.slice(markerIndex + marker.length);
  const content = remainder.startsWith('\n') ? remainder.slice(1) : remainder;
  const lines = content.split('\n');
  const result: Record<string, unknown> = {};

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      if (key) {
        result[key] = val;
      }
    }
  }

  return result;
}

export function findDynamicFieldsInContent(
  content: unknown[]
): Record<string, unknown> | null {
  for (const node of content) {
    if (!node || typeof node !== 'object') {
      continue;
    }
    const children = (node as { content?: unknown[] }).content;
    if (!Array.isArray(children)) {
      continue;
    }
    for (const child of children) {
      if (
        child &&
        typeof child === 'object' &&
        typeof (child as { text?: unknown }).text === 'string'
      ) {
        const text = (child as { text: string }).text;
        if (text.includes('[Dynamic Fields]')) {
          return parseTextDynamicFields(text);
        }
      }
    }
  }
  return null;
}

export function extractDynamicFieldValues(
  description: unknown
): Record<string, unknown> {
  if (!description || typeof description !== 'object') {
    return {};
  }
  try {
    const doc = description as {
      attrs?: { dynamicFields?: unknown };
      content?: unknown[];
    };
    const df = doc.attrs?.dynamicFields;
    if (df && typeof df === 'object' && !Array.isArray(df)) {
      return df as Record<string, unknown>;
    }
    if (Array.isArray(doc.content)) {
      return findDynamicFieldsInContent(doc.content) ?? {};
    }
  } catch {
    return {};
  }
  return {};
}

export function patchWorkItemDynamicFields(
  currentDescription: unknown,
  key: string,
  value: unknown
): Record<string, unknown> {
  let doc: {
    type?: string;
    attrs?: Record<string, unknown>;
    content?: unknown[];
  };
  if (
    currentDescription &&
    typeof currentDescription === 'object' &&
    !Array.isArray(currentDescription)
  ) {
    doc = { ...(currentDescription as Record<string, unknown>) };
  } else {
    doc = { type: 'doc', content: [] };
  }

  const existingAttrs =
    doc.attrs && typeof doc.attrs === 'object' && !Array.isArray(doc.attrs)
      ? { ...doc.attrs }
      : {};

  const initialFields = extractDynamicFieldValues(currentDescription);
  const existingFields: Record<string, unknown> = {
    ...initialFields,
    ...(existingAttrs.dynamicFields &&
    typeof existingAttrs.dynamicFields === 'object' &&
    !Array.isArray(existingAttrs.dynamicFields)
      ? (existingAttrs.dynamicFields as Record<string, unknown>)
      : {}),
  };

  if (value === undefined || value === null || value === '') {
    delete existingFields[key];
  } else {
    existingFields[key] = value;
  }

  existingAttrs.dynamicFields = existingFields;
  doc.attrs = existingAttrs;
  return doc;
}

export interface WorkItemFieldValueMatch {
  id: string;
  title: string;
  value: string;
}

/**
 * Finds all work items that have a configured value for a given field key.
 */
export function findWorkItemsWithFieldValues(
  workItems: Array<{ id: string; title?: string; description?: unknown }>,
  fieldKey: string
): WorkItemFieldValueMatch[] {
  const matches: WorkItemFieldValueMatch[] = [];

  for (const item of workItems) {
    const values = extractDynamicFieldValues(item.description);
    const val = values[fieldKey];
    if (val !== undefined && val !== null && val !== '') {
      const displayVal =
        typeof val === 'object' ? JSON.stringify(val) : String(val);
      matches.push({
        id: item.id,
        title: item.title?.trim() || `Work Item #${item.id.slice(0, 8)}`,
        value: displayVal,
      });
    }
  }

  return matches;
}
