/** % de grasa estimado con la fórmula de la Marina de EE. UU. (cm). Aproximado: ±3–4 %. */
export function navyBodyFat(o: { sex: "m" | "f"; heightCm: number; waist?: number | null; neck?: number | null; hip?: number | null }): number | null {
  const { sex, heightCm: h, waist: w, neck: n, hip } = o;
  if (!w || !n || !h || w <= n) return null;
  const v = sex === "m"
    ? 495 / (1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(h)) - 450
    : hip ? 495 / (1.29579 - 0.35004 * Math.log10(w + hip - n) + 0.221 * Math.log10(h)) - 450 : NaN;
  return Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
}
