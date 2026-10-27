import { useEffect, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabase";

function publicBatchMediaUrl(value: string): string {
  if (/^(?:https?:|blob:|data:|\/)/i.test(value) || !supabase) return value;
  return supabase.storage.from("batch-media").getPublicUrl(value).data.publicUrl;
}

function collectImageUrls(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectImageUrls);
  if (typeof value !== "string") return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    try {
      return collectImageUrls(JSON.parse(trimmed));
    } catch {
      return [];
    }
  }

  return [publicBatchMediaUrl(trimmed)];
}

function resolveImageVariants(...values: unknown[]): string[] {
  return [...new Set(values.flatMap(collectImageUrls))];
}

export default function BatchMedia({
  src,
  alt,
  className,
  style,
  width,
  height,
  draggable,
  loading = "lazy",
}: {
  src?: string | null;
  alt: string;
  className?: string;
  style?: CSSProperties;
  width?: number;
  height?: number;
  draggable?: boolean;
  loading?: "eager" | "lazy";
}) {
  const resolved = resolveImageVariants(src)[0];
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [resolved]);

  if (!resolved || failed) {
    return (
      <span
        aria-hidden="true"
        className={`${className ?? ""} batch-media-empty`.trim()}
        style={{ display: "block", ...style }}
      />
    );
  }

  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      style={style}
      width={width}
      height={height}
      loading={loading}
      draggable={draggable}
      onError={() => setFailed(true)}
    />
  );
}
