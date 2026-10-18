/**
 * Cliente de Claude en Azure AI Foundry. Cero claves de API:
 *  - local: DefaultAzureCredential toma la sesion de `az login`
 *  - produccion: Managed Identity del Container App con rol "Cognitive Services User"
 */
import { AnthropicFoundry } from '@anthropic-ai/foundry-sdk';
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';

const resource =
  process.env.ANTHROPIC_FOUNDRY_RESOURCE ?? process.env.AZURE_FOUNDRY_RESOURCE;

if (!resource) {
  throw new Error(
    'Falta ANTHROPIC_FOUNDRY_RESOURCE (nombre del recurso de Azure AI Foundry). Copia .env.example como .env.',
  );
}

export const MODEL =
  process.env.CLAUDE_DEPLOYMENT ?? process.env.MODEL_DEPLOYMENT_NAME ?? 'claude-opus-5';

// En Windows la primera invocacion de `az` puede tardar mas de 10 s.
const credential = new DefaultAzureCredential({ processTimeoutInMs: 60_000 });

export const claude = new AnthropicFoundry({
  resource,
  azureADTokenProvider: getBearerTokenProvider(credential, 'https://ai.azure.com/.default'),
  maxRetries: 3,
  timeout: 60_000,
});

/**
 * La respuesta puede traer bloques `thinking` antes del `text`: nos quedamos solo con el texto.
 */
export function textOf(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
    .trim();
}

/** Mensaje amable para el estudiante cuando Foundry falla. */
export function friendlyError(err: unknown): string {
  const msg = String((err as Error)?.message ?? err);
  if (/429|rate.?limit/i.test(msg)) {
    return 'Hay mucha gente usando conText en este momento. Espera unos segundos y vuelve a enviar tu mensaje.';
  }
  if (/529|overloaded|503/i.test(msg)) {
    return 'El tutor esta saturado por un momento. Intenta de nuevo en unos segundos.';
  }
  if (/401|403|PermissionDenied/i.test(msg)) {
    return 'No pude conectarme al tutor por un problema de permisos del servidor. Avisa al equipo.';
  }
  if (/timeout|ETIMEDOUT|aborted/i.test(msg)) {
    return 'El tutor se demoro demasiado. Vuelve a intentarlo.';
  }
  return 'Algo fallo al conectar con el tutor. Intenta de nuevo en unos segundos.';
}
