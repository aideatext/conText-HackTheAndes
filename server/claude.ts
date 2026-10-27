/**
 * Cliente de Claude con la API de Anthropic. Cero claves de API:
 *  - local: `ant auth login` deja un perfil que el SDK lee solo
 *  - produccion en Azure: Workload Identity Federation. La Managed Identity del
 *    Container App pide un token de Entra y el SDK lo cambia por uno de Anthropic
 *    que dura minutos y se renueva solo.
 * Sin ANTHROPIC_ENTRA_AUDIENCE, el SDK resuelve solo: ANTHROPIC_API_KEY si existe
 * (hostings sin proveedor de identidad), si no, el perfil de `ant`.
 */
import Anthropic from '@anthropic-ai/sdk';
import { oidcFederationProvider } from '@anthropic-ai/sdk/lib/credentials/oidc-federation';
import type { AccessTokenProvider } from '@anthropic-ai/sdk/lib/credentials/types';
import { DefaultAzureCredential } from '@azure/identity';

export const MODEL =
  process.env.CLAUDE_MODEL ?? process.env.CLAUDE_DEPLOYMENT ?? 'claude-opus-5';

// `api://<APP_ID>` de la app registration que representa a la API de Claude en Entra.
const audience = process.env.ANTHROPIC_ENTRA_AUDIENCE?.trim();

function federacionAzure(): AccessTokenProvider {
  const ruleId = process.env.ANTHROPIC_FEDERATION_RULE_ID;
  const orgId = process.env.ANTHROPIC_ORGANIZATION_ID;
  if (!ruleId || !orgId) {
    throw new Error(
      'ANTHROPIC_ENTRA_AUDIENCE necesita tambien ANTHROPIC_FEDERATION_RULE_ID y ANTHROPIC_ORGANIZATION_ID.',
    );
  }
  // DefaultAzureCredential elige solo el endpoint de identidad del Container App.
  const credential = new DefaultAzureCredential({ processTimeoutInMs: 60_000 });
  return oidcFederationProvider({
    identityTokenProvider: async () => {
      const t = await credential.getToken(`${audience}/.default`);
      if (!t) throw new Error('La Managed Identity no devolvio token de Entra');
      return t.token;
    },
    federationRuleId: ruleId,
    organizationId: orgId,
    serviceAccountId: process.env.ANTHROPIC_SERVICE_ACCOUNT_ID,
    workspaceId: process.env.ANTHROPIC_WORKSPACE_ID,
    baseURL: 'https://api.anthropic.com',
    fetch,
  });
}

export const AUTH = audience ? 'federacion-azure' : 'entorno';

export const claude = new Anthropic({
  ...(audience ? { credentials: federacionAzure() } : {}),
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

/** Mensaje amable para el estudiante cuando la API de Claude falla. */
export function friendlyError(err: unknown): string {
  const msg = String((err as Error)?.message ?? err);
  if (/429|rate.?limit/i.test(msg)) {
    return 'Hay mucha gente usando conText en este momento. Espera unos segundos y vuelve a enviar tu mensaje.';
  }
  if (/529|overloaded|503/i.test(msg)) {
    return 'El tutor esta saturado por un momento. Intenta de nuevo en unos segundos.';
  }
  if (/401|403|PermissionDenied|authentication|credentials/i.test(msg)) {
    return 'No pude conectarme al tutor por un problema de permisos del servidor. Avisa al equipo.';
  }
  if (/timeout|ETIMEDOUT|aborted/i.test(msg)) {
    return 'El tutor se demoro demasiado. Vuelve a intentarlo.';
  }
  return 'Algo fallo al conectar con el tutor. Intenta de nuevo en unos segundos.';
}
