import { isOpenAiConfigured, parseServerEnv } from "@/lib/env";

export function getAiStatus() {
  if (!isOpenAiConfigured()) {
    return {
      enabled: false,
      message:
        "O assistente de IA não está configurado. Defina OPENAI_API_KEY no servidor quando for usar essa função.",
    };
  }

  return {
    enabled: true,
    model: parseServerEnv().OPENAI_MODEL,
  };
}
