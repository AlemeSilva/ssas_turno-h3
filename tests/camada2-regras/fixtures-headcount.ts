// Fábrica partilhada da fixture de "mês fechado" — cada ficheiro de teste
// que a usa passa o seu próprio "baseline" (valores por omissão específicos
// do que esse ficheiro testa); esta fábrica só trata da FORMA comum (os
// campos de HeadcountMensal), nunca dos valores em si. Assim, um campo novo
// em HeadcountMensal só precisa de ser acrescentado aqui, não em cada
// ficheiro de teste — e cada baseline fica explícito e visível no próprio
// ficheiro que o usa, em vez de escondido dentro de uma função quase igual
// à de outro ficheiro (achado de peer-review: os baselines já tinham
// divergido sem ninguém reparar, ex. taxa_cobertura_ferias 0.6 vs. 0.9).
//
// Nota: tests/camada2-regras/headcount.test.ts mantém a sua própria fixture
// de um só argumento (sem mes_referencia) — a maioria dos seus testes nunca
// varia o mês, por isso o argumento extra seria só ruído ali; é uma
// diferença de conveniência deliberada, não divergência não examinada.
import type { HeadcountMensal } from '../../src/types/database'

export function construirFabricaMesFechado(baseline: Omit<HeadcountMensal, 'mes_referencia'>) {
  return function mesFechado(mesReferencia: string, overrides: Partial<HeadcountMensal> = {}): HeadcountMensal {
    return { ...baseline, mes_referencia: mesReferencia, ...overrides }
  }
}
