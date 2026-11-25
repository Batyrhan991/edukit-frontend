import { encode } from "uqr";

/**
 * QR-код как SVG из квадратов: без вставки чужого HTML. Всегда чёрное на белом с полем вокруг —
 * так его надёжно читают камеры телефонов и в тёмной теме.
 */
export function QrCode({ value, label, size = 200 }: { value: string; label: string; size?: number }) {
  const { data } = encode(value, { ecc: "M", border: 4 });
  const cells = data.length;

  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${cells} ${cells}`}
      shapeRendering="crispEdges"
      className="border border-border bg-white"
    >
      <rect width={cells} height={cells} fill="#ffffff" />
      {data.flatMap((row, y) =>
        row.map((dark, x) => (dark ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#000000" /> : null)),
      )}
    </svg>
  );
}
