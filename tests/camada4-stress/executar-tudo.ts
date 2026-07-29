// Orquestrador da CAMADA 4 — corre os cinco cenários em sequência
// (não em paralelo entre si, para os relatórios não se entrelaçarem)
// e resume o resultado no final.

import { execFileSync } from 'node:child_process'

const CENARIOS = [
  'concorrencia-ferias.ts',
  'concorrencia-checklist.ts',
  'bypass-rls-api.ts',
  'latencia-realtime.ts',
  'volume-historico.ts',
]

let falhas = 0

for (const cenario of CENARIOS) {
  console.log(`\n========== ${cenario} ==========`)
  try {
    execFileSync('npx', ['tsx', `tests/camada4-stress/${cenario}`], { stdio: 'inherit' })
  } catch {
    falhas++
    console.error(`FALHOU: ${cenario}`)
  }
}

console.log(`\n===== CAMADA 4 concluída: ${CENARIOS.length - falhas}/${CENARIOS.length} cenários sem falhas. =====`)
if (falhas > 0) process.exit(1)
