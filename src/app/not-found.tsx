import Link from "next/link";
export default function NotFound() {
  return (
    <div className="min-h-dvh grid place-items-center text-center px-6">
      <div><p className="text-7xl">🍌</p><h1 className="mt-4 text-3xl font-extrabold text-ink">Esta página se resbaló</h1><Link href="/" className="btn-primary mt-6">Volver al inicio</Link></div>
    </div>
  );
}
