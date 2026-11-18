import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseAttachment } from "./fileParser";

const { getDocument, createWorker } = vi.hoisted(() => ({
  getDocument: vi.fn(),
  createWorker: vi.fn(),
}));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({ GlobalWorkerOptions: {}, getDocument }));
vi.mock("tesseract.js", () => ({ createWorker }));

const readableText = "This page already contains enough embedded words to skip OCR.";
const makePdf = () => new File(["%PDF"], "attachment.pdf", { type: "application/pdf" });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function mockPage(text: string) {
  return {
    getTextContent: vi.fn(async () => ({ items: [{ str: text, hasEOL: true }] })),
    getViewport: vi.fn(({ scale }) => ({ width: 32 * scale, height: 48 * scale })),
    render: vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() })),
    cleanup: vi.fn(),
  };
}

function mockDocument(pages: ReturnType<typeof mockPage>[], numPages = pages.length) {
  const destroy = vi.fn(async () => {});
  const doc = { numPages, getPage: vi.fn(async (number: number) => pages[number - 1]) };
  getDocument.mockReturnValue({ promise: Promise.resolve(doc), destroy });
  return { doc, destroy };
}

function mockCanvases() {
  const canvases: { width: number; height: number }[] = [];
  vi.stubGlobal("document", {
    createElement: vi.fn(() => {
      const canvas = {
        width: 300,
        height: 150,
        getContext: () => ({
          drawImage: vi.fn(),
          getImageData: () => ({ data: new Uint8ClampedArray(4) }),
          putImageData: vi.fn(),
        }),
        toBlob: (callback: (blob: Blob) => void) => callback(new Blob(["image"], { type: "image/png" })),
      };
      canvases.push(canvas);
      return canvas;
    }),
  });
  return canvases;
}

describe("attachment parsing cleanup", () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("releases text pages and each pair of canvases before OCR, preserving PDF output order", async () => {
    const scanned = [mockPage(""), mockPage("")];
    const embedded = mockPage(readableText);
    const { destroy } = mockDocument([scanned[0], embedded, scanned[1]]);
    const canvases = mockCanvases();
    const recognize = vi.fn(async (image: Blob) => {
      expect(image.type).toBe("image/png");
      expect(canvases.every(({ width, height }) => width === 0 && height === 0)).toBe(true);
      return { data: { text: "Scanned contents" } };
    });
    const terminate = vi.fn(async () => {});
    createWorker.mockResolvedValue({ recognize, terminate, setParameters: vi.fn() });

    await expect(parseAttachment(makePdf())).resolves.toMatchObject({
      pageCount: 3,
      text: `[第 2 页]\n${readableText}\n\n[第 1 页 OCR]\nScanned contents\n\n[第 3 页 OCR]\nScanned contents`,
    });
    expect(embedded.cleanup).toHaveBeenCalledOnce();
    expect(embedded.render).not.toHaveBeenCalled();
    for (const page of scanned) expect(page.cleanup).toHaveBeenCalledTimes(2);
    expect(canvases).toHaveLength(4);
    expect(createWorker).toHaveBeenCalledExactlyOnceWith("eng+chi_sim");
    expect(recognize).toHaveBeenCalledTimes(2);
    expect(terminate).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("destroys the PDF loading task when loading fails", async () => {
    const error = new Error("Unable to load PDF");
    const destroy = vi.fn(async () => {});
    getDocument.mockImplementation(() => ({ promise: Promise.reject(error), destroy }));

    await expect(parseAttachment(makePdf())).rejects.toBe(error);
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("rejects over-limit PDFs before reading any pages and destroys the loading task", async () => {
    const { doc, destroy } = mockDocument([], 31);

    await expect(parseAttachment(makePdf())).rejects.toThrow("PDF 超过 30 页限制");
    expect(doc.getPage).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("cleans the current page and destroys the loading task after text extraction fails", async () => {
    const error = new Error("Unable to extract text");
    const page = mockPage("");
    page.getTextContent.mockRejectedValue(error);
    const { destroy } = mockDocument([page]);

    await expect(parseAttachment(makePdf())).rejects.toBe(error);
    expect(page.cleanup).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("destroys a PDF loading task while the document promise is still pending", async () => {
    const controller = new AbortController();
    const started = deferred<void>();
    const destroy = vi.fn(async () => {});
    getDocument.mockImplementation(() => {
      started.resolve();
      return { promise: new Promise(() => {}), destroy };
    });

    const result = expect(parseAttachment(makePdf(), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    await started.promise;
    controller.abort();
    await result;
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("cancels in-flight PDF rendering and releases its page and canvas", async () => {
    const controller = new AbortController();
    const page = mockPage("");
    const started = deferred<void>();
    const render = deferred<void>();
    const cancel = vi.fn(() => render.reject(new Error("Render canceled")));
    const { destroy } = mockDocument([page]);
    const canvases = mockCanvases();
    page.render.mockImplementation(() => {
      started.resolve();
      return { promise: render.promise, cancel };
    });

    const result = expect(parseAttachment(makePdf(), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    await started.promise;
    controller.abort();
    await result;
    expect(cancel).toHaveBeenCalledOnce();
    expect(page.cleanup).toHaveBeenCalledTimes(2);
    expect(canvases).toMatchObject([{ width: 0, height: 0 }]);
    expect(createWorker).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("terminates an active OCR worker when its recognition never settles", async () => {
    const controller = new AbortController();
    const started = deferred<void>();
    const recognize = vi.fn(() => {
      started.resolve();
      return new Promise(() => {});
    });
    const terminate = vi.fn(async () => {});
    createWorker.mockResolvedValue({ recognize, terminate, setParameters: vi.fn() });
    const { destroy } = mockDocument([mockPage("")]);
    mockCanvases();

    const result = expect(parseAttachment(makePdf(), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    await started.promise;
    controller.abort();
    await result;
    expect(terminate).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("terminates an OCR worker that finishes initializing after cancellation", async () => {
    const controller = new AbortController();
    const started = deferred<void>();
    const terminated = deferred<void>();
    const recognize = vi.fn();
    const terminate = vi.fn(async () => terminated.resolve());
    const worker = deferred<{ recognize: typeof recognize; terminate: typeof terminate }>();
    createWorker.mockImplementation(() => {
      started.resolve();
      return worker.promise;
    });
    const { destroy } = mockDocument([mockPage("")]);
    const canvases = mockCanvases();

    const result = expect(parseAttachment(makePdf(), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    await started.promise;
    controller.abort();
    await result;
    expect(destroy).toHaveBeenCalledOnce();
    expect(canvases).toMatchObject([{ width: 0, height: 0 }, { width: 0, height: 0 }]);

    worker.resolve({ recognize, terminate });
    await terminated.promise;
    expect(terminate).toHaveBeenCalledOnce();
    expect(recognize).not.toHaveBeenCalled();
  });

  it("closes the decoded bitmap and releases canvases for a standalone image", async () => {
    const canvases = mockCanvases();
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 32, height: 48, close })));
    const recognize = vi.fn(async () => {
      expect(close).toHaveBeenCalledOnce();
      expect(canvases).toMatchObject([{ width: 0, height: 0 }, { width: 0, height: 0 }]);
      return { data: { text: "Picture contents" } };
    });
    const terminate = vi.fn(async () => {});
    createWorker.mockResolvedValue({ recognize, terminate, setParameters: vi.fn() });

    const header = new Uint8Array(24);
    header.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    header.set([0x49, 0x48, 0x44, 0x52], 12);
    const dimensions = new DataView(header.buffer);
    dimensions.setUint32(16, 32);
    dimensions.setUint32(20, 48);
    const image = new File([header], "attachment.png", { type: "image/png" });

    await expect(parseAttachment(image)).resolves.toMatchObject({ text: "Picture contents" });
    expect(terminate).toHaveBeenCalledOnce();
    expect(getDocument).not.toHaveBeenCalled();
  });

  it("keeps the text limit and skips work for an already canceled attachment", async () => {
    const file = new File(["a".repeat(60_001)], "attachment.txt");
    await expect(parseAttachment(file)).resolves.toMatchObject({
      text: "a".repeat(60_000), truncated: true,
    });
    const reason = new Error("Cancel this attachment");
    await expect(parseAttachment(makePdf(), AbortSignal.abort(reason))).rejects.toBe(reason);
    expect(getDocument).not.toHaveBeenCalled();
  });
});
