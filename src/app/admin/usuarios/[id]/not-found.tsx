import Link from "next/link";
import { Empty } from "@/components/admin/ui";

export default function UserNotFound() {
  return (
    <div className="card">
      <Empty title="No encontramos este usuario" action={<Link href="/admin/usuarios" className="btn-primary h-10! px-5! text-sm!">Volver a Usuarios</Link>}>
        Puede que la cuenta se haya eliminado o que el enlace esté incompleto.
      </Empty>
    </div>
  );
}
