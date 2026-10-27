# Claude por la API de Anthropic, sin claves

Guía de trabajo. conText deja AI Foundry y llama a la API de Anthropic, que paga con los créditos
de Claude for Startups. El principio no cambia: **cero claves**. En producción la credencial es la
Managed Identity del Container App, igual que hoy con Foundry; en local, el login de `ant`.

El código ya está: [`server/claude.ts`](../server/claude.ts). Lo que sigue es lo que hay que crear
fuera del repo, en Entra y en la Console de Anthropic.

---

## 1. Local

```bash
ant auth login        # abre el navegador; elegir la organización con los créditos
ant auth status       # confirma organización y workspace
npm run dev
```

No va nada en el `.env` para Claude. Si alguien pone `ANTHROPIC_API_KEY` en su shell, esa clave gana
sobre el perfil: `ant auth status` lo dice.

## 2. El workspace y el tope de gasto

En la Console, crear un workspace `context-demo` y ponerle **límite de gasto**. La federación
protege la credencial, no los créditos: una demo abierta los puede consumir igual.

## 3. La audiencia en Entra (una vez por tenant)

Entra solo emite tokens para una audiencia que exista en el tenant.

```bash
APP_ID=$(az ad app create --display-name claude-api-federation --query appId -o tsv)
az ad app update --id "$APP_ID" \
  --identifier-uris "api://$APP_ID" \
  --set api.requestedAccessTokenVersion=2
az ad sp create --id "$APP_ID"
```

## 4. La federación en la Console de Anthropic

Hace falta rol **admin** u **owner** en la organización.

1. *Settings → Workload identity → Connect workload →* **Microsoft Entra**.
2. *Token issuer:* **v2.0 (login.microsoftonline.com)**. El selector viene en v1.
3. Regla: `audience` = `$APP_ID` (el GUID, sin `api://`), y en `claims` el `oid` de la Managed
   Identity del Container App y el `tid` del tenant. Workspace: `context-demo`.
4. **Después del asistente:** pestaña *Issuers*, editar el issuer y subir `max_jwt_lifetime_seconds`
   a **86400**. Azure entrega tokens de Managed Identity con hasta 24 h de vida; con el valor que deja
   el asistente (7500) el intercambio falla con un `401 Authentication failed` que no dice por qué.

El `oid` sale de:

```bash
az containerapp show -n <app> -g rg-context-hackandes --query identity.principalId -o tsv
```

## 5. El Container App

```bash
az containerapp update -n <app> -g rg-context-hackandes \
  --remove-env-vars ANTHROPIC_FOUNDRY_RESOURCE CLAUDE_DEPLOYMENT \
  --set-env-vars \
    CLAUDE_MODEL=claude-opus-5 \
    ANTHROPIC_ENTRA_AUDIENCE=api://$APP_ID \
    ANTHROPIC_FEDERATION_RULE_ID=fdrl_... \
    ANTHROPIC_ORGANIZATION_ID=<uuid> \
    ANTHROPIC_SERVICE_ACCOUNT_ID=svac_... \
    ANTHROPIC_WORKSPACE_ID=wrkspc_... \
  --min-replicas 0
```

Ninguno de esos valores es secreto. `--min-replicas 0` es el ahorro: sin visitas no corre nada, y la
primera visita tarda unos segundos en despertar.

## 6. Verificación

- [ ] `GET /healthz` → `"auth": "federacion-azure"`
- [ ] Un turno en la app → el tutor responde
- [ ] En la Console, *Workload identity → History*: intercambios con éxito
- [ ] `node scripts/smoke.mjs https://context.aideatext.ai`
- [ ] Recién entonces: quitar el rol *Cognitive Services User* y el deployment de Foundry

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| `AADSTS50001` al pedir el token | Falta el `az ad sp create` del paso 3 |
| `401 Authentication failed` en el intercambio | `max_jwt_lifetime_seconds` sigue en 7500 |
| Funciona con otra identidad, no con esta | El `oid` de la regla no es el de la Managed Identity |
| `/healthz` dice `"auth": "entorno"` | Falta `ANTHROPIC_ENTRA_AUDIENCE` en el Container App |

## Fuera de Azure

En hostings sin proveedor de identidad (Hugging Face, Render) no hay federación posible: se deja
`ANTHROPIC_ENTRA_AUDIENCE` vacía y se pone `ANTHROPIC_API_KEY` como secreto de la plataforma. El
código no cambia.
