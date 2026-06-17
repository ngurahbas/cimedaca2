let workerSet = false;

export async function loadPdfJs(): Promise<typeof import('pdfjs-dist')> {
	const pdfjs = await import('pdfjs-dist');
	if (!workerSet) {
		pdfjs.GlobalWorkerOptions.workerSrc = new URL(
			'pdfjs-dist/build/pdf.worker.min.mjs',
			import.meta.url
		).href;
		workerSet = true;
	}
	return pdfjs;
}
