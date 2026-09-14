// Único ficheiro de toda a aplicação que importa 'pdfmake' — sempre via
// import() dinâmico, nunca no topo do ficheiro, para o Vite separar isto
// num chunk à parte que só é pedido quando esta função é mesmo chamada.
// Ninguém que não seja Gerente titular a clicar em "Relatório" chega a
// descarregar este código (ver botão em HeadcountPage.tsx).

import type { TDocumentDefinitions } from 'pdfmake/interfaces'

// @types/pdfmake modela build/pdfmake.js como exportações nomeadas
// (createPdf, addVirtualFileSystem, ...), mas o pacote instalado (0.3.11)
// exporta tudo isso como métodos de um objeto único em `.default` —
// confirmado a correr o build real em Node antes de escrever isto (ver
// .smoke-test-relatorio.ts, apagado depois de verificado). Tipo local
// mínimo, com o que é mesmo chamado, em vez de forçar o tipo da
// biblioteca, que aqui não bate certo com o runtime.
interface PdfMakeBrowser {
  createPdf(documento: TDocumentDefinitions): { download(nomeFicheiro?: string): Promise<void> }
  addVirtualFileSystem(vfs: Record<string, string>): void
}

/**
 * Confirma, em runtime, que o módulo importado tem mesmo o formato que
 * PdfMakeBrowser assume, antes de confiar no cast — achado de peer-review:
 * o cast sozinho (as unknown as) não protege nada se uma futura versão do
 * pacote pdfmake reorganizar a forma do bundle. Lança um erro claro em
 * português em vez de deixar um TypeError críptico chegar ao Gerente.
 */
export function validarPdfMakeBrowser(candidato: unknown): PdfMakeBrowser {
  if (
    typeof candidato === 'object' &&
    candidato !== null &&
    typeof (candidato as Record<string, unknown>).createPdf === 'function' &&
    typeof (candidato as Record<string, unknown>).addVirtualFileSystem === 'function'
  ) {
    return candidato as PdfMakeBrowser
  }
  throw new Error('A biblioteca de geração de PDF não tem o formato esperado. Pode ter sido atualizada de forma incompatível, contacta o suporte técnico.')
}

/** Gera o PDF a partir de um documento já construído (construirDocumentoRelatorioHeadcount)
 * e despoleta o download no browser. Lança se o carregamento dinâmico falhar
 * (rede instável, extensão a bloquear) ou se o pacote pdfmake não tiver o
 * formato esperado (validarPdfMakeBrowser) — quem chama trata o erro. */
export async function descarregarRelatorioHeadcountPdf(documento: TDocumentDefinitions, nomeFicheiro: string): Promise<void> {
  const [pdfMakeModulo, vfsFontsModulo] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  const pdfMake = validarPdfMakeBrowser(pdfMakeModulo.default)
  pdfMake.addVirtualFileSystem(vfsFontsModulo.default)
  await pdfMake.createPdf(documento).download(nomeFicheiro)
}
