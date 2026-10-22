/** Texto con <b>negritas</b> simples, sin HTML arbitrario. */
export function RichTip({ text }: { text: string }) {
  return <>{text.split(/(<b>.*?<\/b>)/g).map((p, i) => (p.startsWith("<b>") ? <b key={i} className="text-ink">{p.slice(3, -4)}</b> : <span key={i}>{p}</span>))}</>;
}
