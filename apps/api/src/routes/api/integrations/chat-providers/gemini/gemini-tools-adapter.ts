import type { AliceChatTools } from '../../../chat/chat.route.types';

type GeminiFunctionDeclaration = {
  name: string;
  description: string;
  parameters?: {
    type: string;
    properties?: Record<string, Record<string, unknown>>;
    required?: readonly string[];
  };
};

type GeminiToolsEnvelope = {
  functionDeclarations: GeminiFunctionDeclaration[];
};

function toGeminiSchemaType(typeValue: string): string {
  return typeValue.toUpperCase();
}

function toGeminiPropertySchema(
  value: Record<string, unknown>
): Record<string, unknown> {
  const converted: Record<string, unknown> = { ...value };
  if (typeof value.type === 'string') {
    converted.type = toGeminiSchemaType(value.type);
  }
  if (value.properties && typeof value.properties === 'object') {
    converted.properties = Object.fromEntries(
      Object.entries(value.properties).map(([key, child]) => [
        key,
        toGeminiPropertySchema(child as Record<string, unknown>),
      ])
    );
  }
  if (value.items && typeof value.items === 'object') {
    converted.items = toGeminiPropertySchema(
      value.items as Record<string, unknown>
    );
  }
  return converted;
}

/** Convert Alice chat tools into Gemini `functionDeclarations` wire format. */
export function aliceChatToolsToGeminiTools(
  tools: AliceChatTools
): GeminiToolsEnvelope[] {
  return [
    {
      functionDeclarations: tools.map((tool) => {
        if (!tool.parameters) {
          return {
            name: tool.name,
            description: tool.description,
          };
        }

        const properties = tool.parameters.properties
          ? Object.fromEntries(
              Object.entries(tool.parameters.properties).map(([key, value]) => [
                key,
                toGeminiPropertySchema(value),
              ])
            )
          : undefined;

        return {
          name: tool.name,
          description: tool.description,
          parameters: {
            type: toGeminiSchemaType(tool.parameters.type),
            ...(properties ? { properties } : {}),
            ...(tool.parameters.required
              ? { required: tool.parameters.required }
              : {}),
          },
        };
      }),
    },
  ];
}
