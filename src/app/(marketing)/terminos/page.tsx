export const metadata = { title: "Términos y condiciones" };

export default function Page() {
  return (
    <article className="mx-auto max-w-3xl px-4 sm:px-6 pt-16 space-y-4 text-body leading-relaxed text-pretty [&>p]:max-w-[65ch]">
      <h1 className="text-4xl font-extrabold tracking-tight text-ink text-balance">Términos y condiciones</h1>
      <p className="chip bg-banana-soft text-banana-ink">Borrador, pendiente de revisión legal</p>
      <p>Banana Burn trata tus datos personales conforme a la Ley N.º 8968 de Protección de la Persona frente al Tratamiento de sus Datos Personales de Costa Rica. Los datos de salud (peso, medidas, fotos, alimentación) se consideran sensibles y solo se procesan con tu consentimiento expreso.</p>
      <p>Puedes solicitar acceso, rectificación, exportación o eliminación de tus datos en cualquier momento desde Ajustes o escribiendo a hola@bananaburn.app.</p>
    </article>
  );
}
