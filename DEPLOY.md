# Turno H3 — Procedimento de Deploy

Guia completo para deploy da aplicação no Netlify e roll-out para uso oficial.

---

## 📋 Pre-Deploy Checklist

Antes de fazer deploy em produção, validar:

- [ ] Todos os testes passam localmente (`npm run test:regras`)
- [ ] E2E suite passa contra staging Supabase (`npm run test:e2e`)
- [ ] Sem console errors ou warnings em desenvolvimento
- [ ] npm audit sem vulnerabilidades críticas (`npm audit`)
- [ ] Código revisado e mergeado para `main`
- [ ] Versão documentada (package.json)
- [ ] .env.local não foi commited (verificar .gitignore)
- [ ] SECURITY_RECOMMENDATIONS.md foi revisto

---

## 🚀 Setup Inicial — Netlify (1-time)

### Pré-requisitos
- Conta Netlify (free tier suficiente)
- Repositório GitHub com código

### Passo 1: Conectar Repositório

1. Login no [Netlify Dashboard](https://app.netlify.com)
2. **New site from Git** → GitHub → Selecionar repositório `ssas_turno-h3`
3. Deploy settings pré-preenchidos:
   - Build command: `npm run build` ✓ (detectado automaticamente)
   - Publish directory: `dist` ✓ (Vite padrão)
   - Node version: `22.x` ✓ (compatível com package.json)

### Passo 2: Configurar Environment Variables

Em **Site settings → Build & deploy → Environment**:

```
VITE_SUPABASE_URL = https://[projeto].supabase.co
VITE_SUPABASE_ANON_KEY = [copiar de Supabase API Keys → Publishable key]
```

**⚠️ IMPORTANTE:**
- As variáveis de prefixo `VITE_` são públicas (injetadas no bundle)
- **Nunca commitar valores reais** — usar Netlify UI ou `.env` local
- Supabase anonkey é intencionalmente pública; RLS protege os dados

### Passo 3: Verificar netlify.toml

```bash
ls -la netlify.toml
```

O ficheiro deve estar no raiz do repo. Contém:
- Build settings
- Security headers (HSTS, X-Frame-Options, etc)
- SPA redirects (React Router)
- Cache rules (assets com immutable hash)

---

## 🔄 Deploy Automático (CI/CD)

### Branch Deployments (Previews)

**Trigger:** Push para qualquer branch que não seja `main`

```bash
git checkout -b feature/nova-funcionalidade
git push origin feature/nova-funcionalidade
# Netlify cria preview automaticamente → URL única para esta branch
```

**Preview URL:** `https://[branch-name]--turno-h3.netlify.app`

**Validar:**
- [ ] Preview carrega sem erros
- [ ] Login Supabase funciona
- [ ] Dados aparecem corretamente

### Production Deploy

**Trigger:** Merge para `main` e push

```bash
git checkout main
git pull origin main
# GitHub Actions roda (Camada 1 pgTAP, Camada 3 E2E)
# Se tudo passa, Netlify faz deploy automático
```

**Production URL:** `https://turno-h3.netlify.app` (customizável)

**Deploy time:** ~2-3 minutos

---

## 📱 Roll-Out Strategy — 3 Fases

### Fase 1: Internal Testing (1-2 semanas)

**Escopo:** Equipa SAS H3 (8 operadores + 1 gerente)

**Ações:**
1. Configurar contas de teste em Supabase (Gerente provisiona 9 utilizadores)
2. Partilhar URL production com equipa
3. Executar UAT (User Acceptance Testing)
4. Recolher feedback

**Validar:**
- [ ] Login funciona para todas as contas
- [ ] Escala semanal é preenchida corretamente
- [ ] Checklist imutável conforme especificado
- [ ] Alertas funcionam (20h, 15h, hr_limite)
- [ ] Relatório exporta corretamente
- [ ] Sem lags/timeouts em operações normais

**Suporte:** Squad SAS disponível em Slack para debugar

### Fase 2: Accenture Staging (1 semana)

**Escopo:** IT corporativa valida integração com infraestrutura

**Ações:**
1. Deploy para staging Supabase project (não contamina dados reais)
2. IT corporativa testa:
   - Acesso via VPN
   - HTTPS/TLS válido
   - Sem erros de CORS
   - Performance sob rede corporativa
3. Validar headers de segurança
4. Smoke test com dados reais (não operações críticas)

**Validar:**
- [ ] Acessível apenas via VPN corporativa
- [ ] HTTPS válido (certificado Let's Encrypt)
- [ ] Performance <2s load time
- [ ] Sem avisos de segurança do browser
- [ ] Logs de auditoria funcionam

### Fase 3: Production Rollout (Gradual)

**Escopo:** Todos os utilizadores H3

**Approach:** Canary (gradual)

#### 3.1 — Canary (25%)

- 2 operadores (1 H3, 1 não-H3) + gerente
- Duração: 3-5 dias
- Monitorar: Supabase logs, Netlify analytics

**Validar:**
- [ ] Zero erros críticos em logs
- [ ] Performance normal (<100ms response time)
- [ ] Dados salvos corretamente
- [ ] Realtime sync funciona
- [ ] Nenhum falso-positivo em alertas

#### 3.2 — Staged (50%)

- 4 operadores + 2 gerentes
- Duração: 1 semana
- Aumentar carga de dados

**Validar:**
- [ ] Escalabilidade OK (múltiplos utilizadores simultâneos)
- [ ] Concorrência tratada (sem data races)
- [ ] Sugestão automática de H3 funciona (edge function)

#### 3.3 — Full Rollout (100%)

- Todos os utilizadores H3
- Duração: 1-2 semanas
- Monitorar continuamente

**Validar:**
- [ ] Toda a equipa H3 consegue fazer login
- [ ] Sem increase de support tickets

---

## ⚙️ Pré-Deploy em Produção — Checklist Final

Executar exatamente nesta ordem:

### 1. Verificar Supabase Production

```bash
# Confirmar que Supabase project existe e está saudável
# Supabase Dashboard → Settings → General

- [ ] API online (green status)
- [ ] Database online
- [ ] Auth habilitado
- [ ] RLS policies ativas (especialmente 07_rls_permissoes.sql)
```

### 2. Verificar Netlify Production Config

```bash
# Netlify UI → Site settings → Build & deploy

- [ ] Build command: npm run build
- [ ] Publish directory: dist
- [ ] Node version: 22.x
- [ ] VITE_SUPABASE_URL definido
- [ ] VITE_SUPABASE_ANON_KEY definido
- [ ] Auto deploy ativado para branch 'main'
```

### 3. Último Commit em Main

```bash
git log --oneline -5
# Confirmar que os 5 commits mais recentes incluem:
# - security: implementar debounce...
# - docs: adicionar status de recomendações...
# - feat(camada4): stress tests...
```

### 4. Correr Testes Finais

```bash
npm run build       # Sem erros TypeScript
npm run test:regras # Todos os testes passam (55 testes)
npm audit --production # Sem vulnerabilidades críticas
```

### 5. Monitorar Deploy

```bash
# Netlify UI → Deploys → Watch for 'Published'
# Tempo esperado: 2-3 minutos
# Red flag: deploy demorar >5min (investigar logs)
```

---

## 🔍 Pós-Deploy — Validação

### Imediatamente após deploy (0-5min)

1. Visitar `https://turno-h3.netlify.app`
   - [ ] Página carrega (<2s)
   - [ ] Layout correto, sem CSS quebrado
   - [ ] Console sem erros (F12 → Console)

2. Login com conta de teste
   - [ ] Email/password aceito
   - [ ] Redirecionado para home
   - [ ] Utilizador autenticado

3. Navegar por abas
   - [ ] Plano carrega dados (GET a Supabase)
   - [ ] Checklist mostra itens
   - [ ] Escala carrega escalas semanais
   - [ ] Nenhuma navegação quebrada

### Nos próximos 1-2 dias

1. Monitorar Supabase logs
   ```
   Supabase Dashboard → Logs → Observe for errors
   ```

2. Verificar Netlify analytics
   ```
   Netlify Dashboard → Analytics → Check for unusual patterns
   ```

3. Acompanhar feedback da equipa
   - Qualquer comportamento inesperado → report
   - Performance issues → check network tab

---

## 🔄 Rollback

Se algo der errado em produção:

### Quick Rollback (< 1 min)

1. Netlify UI → **Deploys** → Listar histórico
2. Encontrar último deploy conhecidamente bom
3. Clicar em **...** → **Publish deploy**
4. Deploy anterior ativa imediatamente
5. Revert commit em main (para evitar re-deploy da versão quebrada)

```bash
git revert HEAD  # Cria novo commit invertendo o anterior
git push origin main
```

---

## 📞 Suporte & Escalation

### Level 1 — Utilizador tem dúvida
→ Squad SAS (via Slack #turno-h3)

### Level 2 — Bug em staging
→ Deploy preview, reparar em branch, push para trigger redeploy

### Level 3 — Bug crítico em produção
→ Rollback imediato + debug em branch feature + redeploy

### Level 4 — Infraestrutura down
→ Contactar Accenture SRE (escalação via Jira)

---

## 📈 Monitoring & Observability

### Supabase Monitoring

```
Dashboard → Logs → Monitor:
- Authentication errors
- RLS violations (should be near zero)
- Query performance (should be <100ms p95)
```

### Netlify Monitoring

```
Dashboard → Analytics → Track:
- Page load times
- Error rates
- Deploy frequency
- Function execution times
```

### User Feedback Channels

- Slack #turno-h3
- In-app error messages (stderr captured in logs)
- Monthly retrospectives

---

## 🎯 Success Criteria

Deployment é considerado **bem-sucedido** quando:

- ✅ Aplicação carrega em <2s
- ✅ Login funciona para todas as contas
- ✅ Sem erros críticos em logs
- ✅ Realtime sync funciona (alterações aparecem em <1s)
- ✅ Nenhum aumento de support tickets
- ✅ Métricas de performance mantidas

---

## 📚 Referências

- **Netlify Docs:** https://docs.netlify.com
- **Vite Build Guide:** https://vitejs.dev/guide/build.html
- **Supabase Production Checklist:** https://supabase.com/docs/guides/platform/going-into-production
- **React Router Deployment:** https://reactrouter.com/start/deployment
- **Security Headers:** https://securityheaders.com

---

**Última atualização:** 2026-07-31
**Versão da app:** 0.0.0 (versionamento iniciará no first GA)
**Status:** Pronto para deploy
