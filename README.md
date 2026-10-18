# conText — Hack the Andes 2026 (Track 03: Educación Escolar)

Un estudiante de secundaria sube una foto o un documento, conversa por texto o por voz con un
tutor socrático sobre ese material, y **ve en tiempo real el grafo de las ideas que está
conectando**, distinguiendo qué conexiones vienen del material y cuáles construyó él.

Derivado de [aideatext/Discovery-conText](https://github.com/aideatext/Discovery-conText),
reescrito sobre **Claude en Azure AI Foundry** con autenticación sin claves (Entra ID / Managed
Identity).

> En construcción durante el hackathon (17–18 oct 2026). README completo al cierre.

## Cómo correrlo en local

```bash
cp .env.example .env     # completa ANTHROPIC_FOUNDRY_RESOURCE
az login                 # la credencial sale de aquí; no hay claves de API
npm install
npm run dev              # http://localhost:3000
```

## Arquitectura

```
Navegador (React + Vite + D3)      Azure Container Apps (Node, Express)        Azure
──────────────────────────         ───────────────────────────────────         ─────
foto/PDF/txt ──POST /api/material─► normaliza → Claude (visión/PDF) ──────────► Foundry: claude-opus-5
chat/dictado ──POST /api/turn ────► 1) tutor socrático (streaming SSE)          (Entra ID / MI)
   (SSE)                            2) extractor de grafo (JSON validado)
                                    3) persiste turno + delta ────────────────► Table Storage
```

Sin secretos en el repo ni en el bundle del navegador: todas las llamadas al modelo pasan por el
servidor y la credencial es la identidad administrada del contenedor.

## Licencia

Apache-2.0 (igual que el repo base).
