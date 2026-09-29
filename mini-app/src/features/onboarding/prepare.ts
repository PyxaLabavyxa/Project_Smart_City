type Router = { replace: (href: string, options: { scroll: boolean }) => void; prefetch: (href: string) => void };
const pages = ["/", "/issues", "/plan", "/messages", "/utilities", "/cameras", "/issues/new", "/health", "/info", "/more"];

/** Mount each route behind the preparation screen: this warms code, data and image decodes. */
export async function prepareTour(router: Router, signal: AbortSignal, progress: (done: number, total: number) => void) {
  const routes = [...pages];
  for (const href of routes) router.prefetch(href);
  let camera = "/cameras";
  for (let index = 0; index < routes.length; index++) {
    signal.throwIfAborted();
    const href = routes[index];
    progress(index, routes.length + 1);
    router.replace(href, { scroll: false });
    await waitForPage(href, signal);
    if (href === "/cameras") {
      const link = document.querySelector<HTMLAnchorElement>('[data-tour="camera-card"]');
      if (link && /^\/cameras\/[1-9][0-9]*$/.test(link.pathname)) {
        camera = link.pathname;
        routes.push(camera);
        router.prefetch(camera);
      }
    }
  }
  router.replace("/", { scroll: false });
  await waitForPage("/", signal);
  progress(routes.length + 1, routes.length + 1);
  return camera;
}

function waitForPage(path: string, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const started = Date.now();
    let stableSince = 0;
    const finish = (error?: Error) => {
      clearInterval(timer);
      signal.removeEventListener("abort", abort);
      if (error) reject(error); else resolve();
    };
    const abort = () => finish(new DOMException("Подготовка отменена", "AbortError"));
    const timer = window.setInterval(() => {
      const main = document.querySelector<HTMLElement>("#main");
      const pending = !main || main.dataset.pagePath !== path || main.querySelector('[aria-busy="true"]') || document.querySelector('[data-app-loading="true"]');
      const images = main ? Array.from(main.querySelectorAll("img")) : [];
      for (const image of images) image.loading = "eager";
      const ready = !pending && images.every(image => image.complete) && document.fonts.status === "loaded";
      if (!ready) stableSince = 0;
      else if (!stableSince) stableSince = Date.now();
      // Allow effects, cached fetches, layout and route animations to settle before continuing.
      if (stableSince && Date.now() - stableSince >= 220) finish();
      else if (Date.now() - started > 18000) finish(new Error("Не удалось подготовить все разделы. Проверьте соединение и попробуйте ещё раз."));
    }, 60);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}
