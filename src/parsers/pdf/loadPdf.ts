/**
 * pdf.js 문서 열기. 브라우저와 Vitest(Node) 양쪽에서 같은 코드를 쓰도록
 * legacy 빌드를 사용한다. 브라우저 워커 경로는 src/ui/setupPdfWorker.ts에서 지정하고,
 * Node에서는 지정하지 않아도 pdf.js가 같은 스레드의 가짜 워커로 동작한다.
 */
import { getDocument, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function loadPdf(data: ArrayBuffer | Uint8Array): Promise<PDFDocumentProxy> {
  // pdf.js가 버퍼를 워커로 넘기며 detach할 수 있으므로 복사본을 넘긴다.
  const bytes = new Uint8Array(data instanceof Uint8Array ? data : new Uint8Array(data)).slice();
  return getDocument({ data: bytes }).promise;
}
