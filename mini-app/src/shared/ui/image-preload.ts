const images = new Map<string, Promise<HTMLImageElement>>();
/** Resolve only after each image is decoded and ready to display. */
export async function preloadImages(urls: readonly string[], signal: AbortSignal, progress: (percent: number) => void = () => {}) {
  const sources = [...new Set(urls)];
  let loaded = 0;
  signal.throwIfAborted();
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(60000)]);
  await Promise.all(sources.map(async source => {
    let pending = images.get(source);
    if (!pending) {
      const image = new Image(); image.src = source;
      pending = image.decode().then(() => image).catch(error => { images.delete(source); throw error; });
      images.set(source, pending);
    }
    try {
      await waitForImage(pending, deadline);
    } catch (error) {
      // A stalled request must not trap every subsequent retry in the same promise.
      if (deadline.reason?.name === "TimeoutError" && images.get(source) === pending) images.delete(source);
      throw error;
    }
    signal.throwIfAborted();
    progress(++loaded / sources.length * 100);
  }));
  if (!sources.length) progress(100);
}

function waitForImage(pending: Promise<HTMLImageElement>, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    pending.then(() => {
      signal.removeEventListener("abort", abort);
      if (!signal.aborted) resolve();
    }, error => { signal.removeEventListener("abort", abort); reject(error); });
  });
}
