export const PRODUCT_ICON_SRC = `${import.meta.env.BASE_URL}navopath-icon.png`;

export function ProductIcon({ compact = false }: { compact?: boolean }) {
  const size = compact ? 32 : 36;
  return (
    <div className={`dayflow-icon ${compact ? "compact" : ""}`} aria-hidden="true">
      <img src={PRODUCT_ICON_SRC} alt="" width={size} height={size} />
    </div>
  );
}
