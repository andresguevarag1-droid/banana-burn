import Link from "next/link";
import { Empty, btnPrimary } from "@/components/admin/ui";

export default function UserNotFound() {
  return (
    <Empty title="No encontramos este usuario" action={<Link href="/admin/usuarios" className={btnPrimary}>Volver a Usuarios</Link>}>
      Puede que la cuenta se haya eliminado o que el enlace esté incompleto.
    </Empty>
  );
}
