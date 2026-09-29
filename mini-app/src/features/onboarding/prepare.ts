type Router = { replace: (href: string, options: { scroll: boolean }) => void; prefetch: (href: string) => void };
const pages = ["/", "/issues", "/plan", "/messages", "/utilities", "/cameras", "/issues/new", "/health", "/info", "/more"];

/** Mount each route behind the preparation screen: this warms code, data and image decodes. */
export async function prepareTour(router: Router, signal: AbortSignal, progress: (done: number, total: number) => void, destination = "/") {
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
      const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-tour="camera-card"]')];
      for (const link of links) {
        if (!/^\/cameras\/[1-9][0-9]*$/.test(link.pathname) || routes.includes(link.pathname)) continue;
        if (camera === "/cameras") camera = link.pathname;
        routes.push(link.pathname);
        router.prefetch(link.pathname);
      }
    }
  }
  router.replace(destination, { scroll: false });
  await waitForPage(destination.split("?")[0], signal);
  progress(routes.length + 1, routes.length + 1);
  return camera;
}

function waitForPage(path: string, signal: AbortSignal) {
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
      const pending = !main || main.dataset.pagePath !== path || main.querySelector('[aria-busy="true"]') || document.querySelector('[data-app-loading="true"]');
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
