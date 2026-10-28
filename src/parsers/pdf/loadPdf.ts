/**
 * pdf.js 문서 열기. 브라우저와 Vitest(Node) 양쪽에서 같은 코드를 쓰도록 legacy 빌드를 사용한다.
 * 이 모듈은 PDF를 받았을 때만 불러온다(엑셀만 쓰면 pdf.js를 내려받지 않음).
 * 브라우저에서는 처음 열 때 워커 파일 위치를 지정하고, Node에서는 같은 스레드의 가짜 워커로 동작한다.
 */
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';

async function ensureWorker(): Promise<void> {
  if (typeof document === 'undefined' || GlobalWorkerOptions.workerSrc) return;
  const { default: workerUrl } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
  GlobalWorkerOptions.workerSrc = workerUrl;
}

export async function loadPdf(data: ArrayBuffer | Uint8Array): Promise<PDFDocumentProxy> {
  await ensureWorker();
  // pdf.js가 버퍼를 워커로 넘기며 detach할 수 있으므로 복사본을 넘긴다.
  const bytes = new Uint8Array(data instanceof Uint8Array ? data : new Uint8Array(data)).slice();
  return getDocument({ data: bytes }).promise;
}
