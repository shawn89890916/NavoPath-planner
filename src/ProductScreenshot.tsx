import type { ProductFeature } from "./productSite";
import type { Language } from "./types";

export default function ProductScreenshot({ feature, lang, alt, eager = false }: {
  feature: ProductFeature | "principles";
  lang: Language;
  alt: string;
  eager?: boolean;
}) {
  return <picture className="np-product-screenshot">
    <source media="(orientation: portrait)" srcSet={`/product-${feature}-${lang}-portrait.webp`} width={390} height={844} />
    <img
      src={feature === "principles" ? `/product-entry-principles-${lang}.jpg` : `/product-${feature}-${lang}-landscape.webp`}
      width={feature === "principles" ? 1280 : 1440}
      height={feature === "principles" ? 800 : 900}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
    />
  </picture>;
}
