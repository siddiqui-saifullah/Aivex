import { useEffect, useRef, useState } from "react";

interface LazyVideoProps {
  src: string;
  poster: string;
  className?: string;
  label: string;
}

/**
 * Muted looping demo video that only downloads once it scrolls into view,
 * showing a lightweight poster image until then.
 */
const LazyVideo = ({ src, poster, className, label }: LazyVideoProps) => {
  const ref = useRef<HTMLVideoElement>(null);
  // Old browsers without IntersectionObserver just load the video right away
  const [visible, setVisible] = useState(
    () => typeof window !== "undefined" && !("IntersectionObserver" in window),
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <video
      ref={ref}
      src={visible ? src : undefined}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="none"
      aria-label={label}
      className={className}
    />
  );
};

export default LazyVideo;
