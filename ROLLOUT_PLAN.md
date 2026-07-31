# Turno H3 — Plano de Roll-Out para Uso Oficial

Estratégia faseada de propagação da aplicação para toda a equipa H3.

---

## 📊 Timeline Estimada

```
Fase 1: Internal Testing      2026-08-01 → 2026-08-15  (15 dias)
Fase 3: Production (100%)     2026-08-16 → ongoing     (go-live)

**Data-alvo de Go-Live:** 2026-08-16
```

---

## 🎯 Fase 1 — Internal Testing (SAS H3 Team)

### Objetivos

1. Validar que a aplicação está pronta para equipas reais
2. Treinar utilizadores em features (escala, checklist, alertas)
3. Recolher feedback sobre UX/bugs antes de produção
4. Documentar procedure de suporte

### Participants

- **Operadores H3:** Bruno, Kilson + 1 novo (3 total)
- **Operadores:** 3 operadores comuns
- **Gerente:** 1 gerente
- **Support:** Squad SAS (no Slack)

### Atividades Diárias

| Dia | Atividade | Owner | Success Criteria |
|-----|-----------|-------|-----------------|
| D1-2 | Criar contas em Supabase | Gerente | 9 utilizadores criados |
| D2 | Treino: Login + Home | Squad | Todos conseguem fazer login |
| D3-4 | Treino: Escala (visualização + alteração) | Squad | Todos entendem ciclo semanal |
| D5-6 | Treino: Checklist (2-step confirmation) | Squad | Sem erros de UX no carimbo |
| D7 | Treino: Alertas (20h, 15h, hr_limite) | Squad | Alertas aparecem conforme esperado |
| D8-10 | UAT: Operações normais (1-2h/dia) | Operadores | Sem bugs críticos encontrados |
| D11-14 | Fase estabilização + recolher feedback | Gerente | Feedback consolidado |

### Métricas de Sucesso

- ✅ 0 erros críticos em logs
- ✅ 100% de utilizadores conseguem fazer login
- ✅ Tempo de carregamento <2s (median)
- ✅ Nenhuma data loss
- ✅ Alertas funcionam conforme especificado
- ✅ Relatório exporta sem erros

### Contingency

Se encontrado bug crítico:
1. Reportar em Slack #turno-h3
2. Squad investiga no branch feature
3. Reparação testada em staging
4. Redeployment automático quando mergeado
5. Continuar teste com versão fixa

### Saída Esperada

- ✅ Lista de bugs encontrados (prioridade P1-P4)
- ✅ UAT sign-off (Gerente assina documento)
- ✅ Feedback consolidado (UX improvements backlog)
- ✅ Documentação de suporte (FAQ, troubleshooting)

---

## 🚀 Fase 3 — Production Rollout (Full)

**Timing:** Após aprovação da Fase 1 (2026-08-16)

**Users:** Todos os operadores H3 (8+)

**Atividades:**
1. Onboard todos os utilizadores restantes
2. Comunicar go-live via email + Slack
3. Disponibilizar suporte 24/7 (primeiros 3 dias)
4. Monitorar logs e performance continuamente
5. Recolher feedback dos utilizadores

**Validações:**
- [ ] Todos conseguem fazer login
- [ ] Escala semanal visualiza e altera corretamente
- [ ] Checklist funciona conforme esperado
- [ ] Alertas disparam normalmente
- [ ] Relatório exporta sem erros
- [ ] Nenhum erro crítico em logs

**Saída:** ✅ Production rollout completed successfully

---

## 📢 Communication Plan

### Pre-Launch (2 semanas antes)

**Email:** "Turno H3 — Nova aplicação em breve"

```
Assunto: Novo sistema Turno H3 disponível em produção

Caros colegas,

Estamos entusiasmados em anunciar a disponibilidade da nova aplicação
Turno H3 para organização de escalas e checklist operacional.

📅 Timeline:
- Fase 1 (Teste Interno): 2026-08-01 → 2026-08-15
- Fase 2 (Staging): 2026-08-15 → 2026-08-22
- Fase 3 (Produção): 2026-08-22 → 2026-09-05

✨ Features principais:
- Visualização de escala semanal com trocas instantâneas
- Checklist imutável com carimbo de execução
- Alertas automáticos (20h/15h/HR.LIMITE)
- Relatório de auditoria completo

🆘 Suporte:
- Slack: #turno-h3
- FAQ: https://turno-h3.netlify.app/help (when available)

Em breve, mais detalhes.

Squad SAS
```

### Go-Live Day

**Slack post in #turno-h3:**

```
🚀 GO-LIVE: Turno H3 em Produção!

A aplicação está agora disponível para todos em:
https://turno-h3.netlify.app

✅ Verificações:
- Fazer login com as suas credenciais
- Verificar que a sua escala semanal aparece
- Reportar qualquer anomalia neste thread

🆘 Problemas? Responda neste thread ou use /channel-topic

Obrigado!
```

### Post-Launch (Week 1)

**Daily check-in in #turno-h3:**

```
📊 Daily Health Check
- Utilizadores online: X
- Erros críticos: 0
- Performance (p95): XXms
- Support tickets: X (resolução in progress)
```

### Feedback Collection (Week 2-4)

**Slack poll:**

```
👍 Como tem sido a experiência com o Turno H3?
- Muito bom, sem problemas
- Bom, alguns pontos de melhoria
- Há alguns bugs que precisam de ser corrigidos
- Há problemas críticos
```

---

## 🎓 Treino & Documentação

### User Guide (Criar antes de Fase 1)

- **Login & Home:** Como autenticar-se
- **Escala Visual:** Interpretação do calendario, cores, status
- **Modificar Escala:** Solicitar troca, ver aprovações
- **Checklist:** 2-step confirmation, carimbo imutável
- **Alertas:** O que significa cada alerta, como reagir
- **Relatório:** Exportação e interpretação
- **FAQ:** Problemas comuns + soluções

### Video Tutorials (Optional, Week 1)

- 5-min: Visão geral da interface
- 3-min: Como solicitar troca de H3
- 3-min: Como marcar checklist
- 2-min: O que fazer quando alerta da 20h aparece

### On-Call Support (Week 1-2)

- Squad SAS disponível em Slack #turno-h3
- Response time: <1 hour para critical issues
- Fallback: escalação para Accenture SRE se infraestrutura

---

## 📊 Success Metrics

### Fase 1 Metrics

- User adoption: 100% (9/9 conseguem fazer login)
- System availability: >99.5%
- Critical bugs found: <5
- Data loss incidents: 0
- Feedback consolidado: documento com melhorias sugeridas

### Fase 3 Metrics

- Full rollout adoption: >95% within 1 week
- System availability: >99.5%
- Support tickets: <3 critical issues
- Performance: <2s load time, <100ms DB queries

---

## ⚠️ Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Auth rate-limiting | Medium | High | Test with mock load in staging |
| Realtime lag >3s | Low | High | Monitor latency metrics, rollback threshold |
| Data corruption | Very Low | Critical | RLS tested in 3 layers, nightly backups |
| User adoption <50% | Low | Medium | Strong training, responsive support |
| Concurrent write conflicts | Very Low | High | Exclusion constraint for ferias, locks for trocas |

---

## 📋 Final Pre-Launch Checklist (T-1 day — 2026-08-15)

- [ ] Fase 1 UAT sign-off (Gerente)
- [ ] Todos os testes passam (Camadas 1-4)
- [ ] npm audit sem vulnerabilidades críticas
- [ ] Supabase production data backup (automated daily)
- [ ] Rollback procedure tested (can rollback in <2 min)
- [ ] Support team trained (FAQ, runbook reviewed)
- [ ] Monitoring alerts configured (page on error, warning on latency)
- [ ] Netlify auto-deploy enabled for main branch
- [ ] Communication sent (email + Slack)
- [ ] Go-live support on-call 24/7

---

**Approved by:** [Gerente H3]
**Date:** [Data de assinatura]
**Status:** Ready for Phase 1

---

**Next Review:** Post-launch retrospective (2026-09-12)
