import { parsePdfPages } from './pdfTable.js'

export async function parseCartPDF(file) {
  if (file.size > 5 * 1024 * 1024)
    return { data: [], errors: ['Please choose a PDF smaller than 5 MB.'] }
  let task
  try {
    const pdfjs = await import('pdfjs-dist')
    const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    task = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      isEvalSupported: false,
    })
    const pdf = await task.promise
    if (pdf.numPages > 10)
      return { data: [], errors: ['Please use a cart PDF with 10 pages or fewer.'] }
    const pages = []
    for (let number = 1; number <= pdf.numPages; number += 1) {
      const page = await pdf.getPage(number)
      pages.push((await page.getTextContent()).items)
    }
    if (pages.every((page) => !page.some((item) => item.str?.trim()))) {
      return {
        data: [],
        errors: [
          'This PDF has no selectable text. Scanned images need OCR; please upload a text PDF or CSV.',
        ],
      }
    }
    return parsePdfPages(pages)
  } catch (error) {
    const message =
      error.name === 'PasswordException'
        ? 'This PDF is password protected. Please upload an unlocked copy.'
        : 'Could not read this PDF. Please check that it opens correctly and contains a text table.'
    return { data: [], errors: [message] }
  } finally {
    await task?.destroy()
  }
}
