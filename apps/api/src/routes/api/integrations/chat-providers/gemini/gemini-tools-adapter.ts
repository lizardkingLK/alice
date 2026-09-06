import type { AliceChatTools } from '../../../chat/chat.route.types';

type GeminiFunctionDeclaration = {
  name: string;
  description: string;
  parameters?: {
    type: string;
    properties?: Record<string, { type: string; [key: string]: unknown }>;
    required?: readonly string[];
  };
};

type GeminiToolsEnvelope = {
  functionDeclarations: GeminiFunctionDeclaration[];
};

function toGeminiSchemaType(typeValue: string): string {
  return typeValue.toUpperCase();
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
                {
                  ...value,
                  type: toGeminiSchemaType(value.type),
                },
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
