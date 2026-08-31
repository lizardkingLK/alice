import { parseWithZod } from '@/lib/zod/format-zod-error';
import {
  createWorkItemBodySchema,
  patchWorkItemBodySchema,
  preprocessWorkItemMutationBody,
  type CreateWorkItemBody,
  type PatchWorkItemBody,
} from '@repo/types/api/v1';

function formDataToRecord(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(formData.entries());
}

export function parsePatchWorkItemBody(
  body: Record<string, unknown>
): PatchWorkItemBody {
  const preprocessed = preprocessWorkItemMutationBody(body);
  if (!preprocessed) {
    throw new Error('Invalid JSON format provided for description field');
  }

  return parseWithZod(patchWorkItemBodySchema, preprocessed);
}

export function parseCreateWorkItemFormData(
  formData: FormData
): CreateWorkItemBody {
  const preprocessed = preprocessWorkItemMutationBody(
    formDataToRecord(formData),
    {
      descriptionParseMode: 'lenient',
    }
  );
  if (!preprocessed) {
    throw new Error('Invalid JSON format provided for description field');
  }

  return parseWithZod(createWorkItemBodySchema, preprocessed);
}

export function parsePatchWorkItemFormData(
  formData: FormData,
  expectedUpdatedAt: string
): PatchWorkItemBody {
  return parsePatchWorkItemBody({
    ...formDataToRecord(formData),
    expectedUpdatedAt,
  });
}

export function parseForcePatchWorkItemBody(
  pendingFields: Record<string, unknown>,
  expectedUpdatedAt: string
): PatchWorkItemBody {
  return parsePatchWorkItemBody({ ...pendingFields, expectedUpdatedAt });
}
