import { describe, expect, it } from 'vitest'
import { validarPdfMakeBrowser } from '../../src/lib/relatorio-headcount-pdf'

// Este ficheiro tinha zero cobertura de testes antes (achado de
// peer-review) — descarregarRelatorioHeadcountPdf em si não é testável
// aqui (.download() só existe no browser real), mas a guarda de forma que
// protege o cast por baixo dela é uma função pura, isolada e testável.
describe('validarPdfMakeBrowser — guarda de runtime contra uma futura versão de pdfmake com formato diferente', () => {
  it('aceita um objeto com createPdf e addVirtualFileSystem como funções', () => {
    const valido = { createPdf: () => {}, addVirtualFileSystem: () => {} }
    expect(validarPdfMakeBrowser(valido)).toBe(valido)
  })

  it('rejeita null', () => {
    expect(() => validarPdfMakeBrowser(null)).toThrow(/formato esperado/)
  })

  it('rejeita undefined', () => {
    expect(() => validarPdfMakeBrowser(undefined)).toThrow(/formato esperado/)
  })

  it('rejeita um objeto sem createPdf', () => {
    expect(() => validarPdfMakeBrowser({ addVirtualFileSystem: () => {} })).toThrow(/formato esperado/)
  })

  it('rejeita um objeto sem addVirtualFileSystem', () => {
    expect(() => validarPdfMakeBrowser({ createPdf: () => {} })).toThrow(/formato esperado/)
  })

  it('rejeita quando createPdf/addVirtualFileSystem existem mas não são funções (ex.: um pdfmake futuro que os torna propriedades aninhadas)', () => {
    expect(() => validarPdfMakeBrowser({ createPdf: 'não é função', addVirtualFileSystem: () => {} })).toThrow(/formato esperado/)
  })
})
