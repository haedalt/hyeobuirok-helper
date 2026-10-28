import { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

/** 브라우저 전용: pdf.js 워커 파일 위치를 지정한다 (Vite가 번들에 포함). */
GlobalWorkerOptions.workerSrc = workerUrl;
