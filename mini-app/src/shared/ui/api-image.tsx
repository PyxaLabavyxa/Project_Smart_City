"use client";
import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { useApi } from "@/shared/api/context";
import { apiUrl } from "@/shared/api/client";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onError"> & { path: string; alt: string };

export function ApiImage(props: Props) {
  return <PrivateImage key={props.path} {...props} />;
}

function PrivateImage({ path, alt, style, ...props }: Props) {
  const api = useApi();
  const request = useRef<{ controller: AbortController; url?: string } | null>(null);
  const [fallback, setFallback] = useState<{ src?: string; loading: boolean }>({ loading: false });
  useEffect(() => () => {
    request.current?.controller.abort();
    if (request.current?.url) URL.revokeObjectURL(request.current.url);
  }, []);

  async function recover() {
    if (request.current) return;
    const current = { controller: new AbortController(), url: undefined as string | undefined };
    request.current = current;
    setFallback({ loading: true });
    try {
      const blob = await api(path, { responseType: "blob", signal: current.controller.signal });
      current.controller.signal.throwIfAborted();
      if (!(blob instanceof Blob) || !/^image\/(jpeg|png|webp)$/.test(blob.type)) throw new Error("Некорректное изображение");
      current.url = URL.createObjectURL(blob);
      setFallback({ src: current.url, loading: false });
    } catch {
      if (!current.controller.signal.aborted) setFallback({ loading: false });
    }
  }

  // Preserve native lazy loading and the regular cookie path. A private Blob
  // supplies authenticated images when Safari prevents <img> from using cookies.
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} alt={alt} src={fallback.src ?? apiUrl(path)} style={{ ...style, visibility: fallback.loading ? "hidden" : style?.visibility }} onError={() => void recover()} />;
}
