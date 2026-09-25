import { describe, expect, it } from 'vitest'
import { nomeParaLista } from '../../src/lib/usuarios'

describe('nomeParaLista — quem já saiu aparece nas listas de histórico, mas assinalado', () => {
  it('quem está ativo aparece só com o nome', () => {
    expect(nomeParaLista({ nome: 'Bruno Diniz', ativo: true })).toBe('Bruno Diniz')
  })

  it('quem já saiu aparece com "(inativo)" a seguir ao nome', () => {
    expect(nomeParaLista({ nome: 'Pedro Nascimento', ativo: false })).toBe('Pedro Nascimento (inativo)')
  })

  it('não altera o nome guardado — só o texto mostrado', () => {
    const pedro = { nome: 'Pedro Nascimento', ativo: false }
    nomeParaLista(pedro)
    expect(pedro.nome).toBe('Pedro Nascimento')
  })
})
