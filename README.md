# Financeiro Familiar

Aplicativo web para o controle financeiro da casa. MVP em Next.js, Neon e Better Auth.

A Fase 2 cobre a Casa compartilhada, o onboarding, contas manuais, categorias iniciais e o convite da família. Sem a Casa, o início redireciona para `/onboarding`.

## Requisitos locais

- Node.js 20+
- pnpm 11
- Projeto Neon com `DATABASE_URL`

## Configuração

```bash
pnpm install
cp .env.example .env.local
```

Preencha no `.env.local`:

- `DATABASE_URL` — connection string do Neon de desenvolvimento
- `BETTER_AUTH_SECRET` — string aleatória com pelo menos 32 caracteres
- `BETTER_AUTH_URL` e `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` no desenvolvimento
- `TEST_DATABASE_URL` e `TEST_DATABASE_BRANCH=test` — branch Neon isolada para Vitest de escrita e Playwright

`OPENAI_API_KEY` e `OPENAI_MODEL` são opcionais. Sem a chave, o restante do app continua funcionando e o assistente fica desativado.

## Ambientes

| Contexto | Banco | URL |
| --- | --- | --- |
| Desenvolvimento | branch Neon de desenvolvimento | `http://localhost:3000` |
| Testes automatizados | branch Neon `test` via `TEST_DATABASE_URL` | Playwright em `localhost:3100` |
| Preview | branch Neon `preview` (recomendada) | URL da Vercel Preview |
| Produção | branch principal, só após homologação | domínio definitivo |

Para criar a branch de testes no Neon:

```bash
# No console ou via CLI, a partir da branch principal
# Nome obrigatório: test ou preview
# Copie a connection string para TEST_DATABASE_URL
# Defina TEST_DATABASE_BRANCH=test
```

Os testes que gravam no banco recusam `DATABASE_URL` de produção. Sem `TEST_DATABASE_URL` identificada como `test` ou `preview`, a integração é ignorada e o Playwright falha com mensagem explícita.

O rate limit do Better Auth é em memória e não é compartilhado entre instâncias da Vercel.

```bash
pnpm db:migrate
pnpm dev
```

## Scripts

| Script | Uso |
| --- | --- |
| `pnpm dev` | Servidor local |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript sem emitir arquivos |
| `pnpm test` | Vitest |
| `pnpm test:e2e` | Playwright |
| `pnpm build` | Build de produção |
| `pnpm db:generate` | Gerar migration a partir do schema |
| `pnpm db:migrate` | Aplicar migrations no Neon |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm db:seed` | Seed de desenvolvimento (recusa produção) |
| `pnpm db:check` | Verifica schema e migrations versionadas |

Não use `drizzle-kit push` em produção. Não coloque migrate no comando de build da Vercel.

O pnpm 11 exige permissão explícita para scripts de build. O `esbuild` está permitido em `pnpm-workspace.yaml` porque o Drizzle Kit e as ferramentas de teste dependem dele.

## Deploy

1. Criar projeto no Neon e obter `DATABASE_URL`
2. Configurar as variáveis na Vercel
3. Executar `pnpm db:migrate` de forma controlada
4. Criar o projeto na Vercel
5. Fazer deploy de preview
6. Rodar smoke tests (`/login`, `/api/health`)
7. Autorizar deploy de produção

O seed de demonstração nunca deve rodar em produção.
