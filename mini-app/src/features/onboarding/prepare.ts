type Router = { replace: (href: string, options: { scroll: boolean }) => void; prefetch: (href: string) => void };
const pages = ["/", "/issues", "/plan", "/messages", "/utilities", "/cameras", "/issues/new", "/health", "/info", "/more"];

export async function prepareTour(router: Router, signal: AbortSignal, progress: (percent: number) => void, destination = "/") {
  for (const href of pages) router.prefetch(href);
  progress(0);
  for (let index = 0; index < pages.length; index++) {
    signal.throwIfAborted();
    const href = pages[index];
    router.replace(href, { scroll: false });
    await waitForPage(href, signal);
    progress((index + 1) / pages.length * 90);
  }
  signal.throwIfAborted();
  router.replace(destination, { scroll: false });
  await waitForPage(destination.split("?")[0], signal);
  progress(100);
  return "/cameras";
}

function waitForPage(path: string, signal: AbortSignal) {
  const expectedPath = path.replace(/\/+$/, "") || "/";
  return new Promise<void>((resolve, reject) => {
    const started = Date.now();
    let finishing = false;
    const finish = (error?: Error) => {
      clearInterval(timer);
      signal.removeEventListener("abort", abort);
      if (error) reject(error); else resolve();
    };
    const abort = () => finish(new DOMException("Подготовка отменена", "AbortError"));
    const timer = window.setInterval(() => {
      const main = document.querySelector<HTMLElement>("#main");
      const actualPath = main?.dataset.pagePath;
      const pending = !main || actualPath === undefined || (actualPath.replace(/\/+$/, "") || "/") !== expectedPath || main.querySelector('[aria-busy="true"]') || document.querySelector('[data-app-loading="true"]');
      const images = main ? Array.from(main.querySelectorAll("img")) : [];
      for (const image of images) image.loading = "eager";
      const error = !pending && main?.querySelector('.request-state[role="alert"]');
      if (error) { finish(new Error(error.textContent || "Не удалось загрузить раздел")); return; }
      const ready = !pending && images.every(image => image.complete) && document.fonts.status === "loaded";
      if (ready && !finishing) {
        finishing = true;
        Promise.all(images.map(image => image.decode())).then(() => finish(), () => finish(new Error("Не удалось загрузить изображения. Повторите попытку.")));
      } else if (Date.now() - started > 18000) finish(new Error("Не удалось подготовить все разделы. Проверьте соединение и попробуйте ещё раз."));
    }, 60);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}
