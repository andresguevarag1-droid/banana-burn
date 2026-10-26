// ¿Ofrecer avisos dentro de la app? Sin importar los plugins (lo usan componentes que también corren en la web).
// NEXT_PUBLIC_NATIVE_PUSH=1 cuando el servidor ya tiene las llaves (FCM y APNs) y el APK trae Firebase.
import { hasNativePlugin } from "@/lib/platform";

export const NATIVE_PUSH_ON = process.env.NEXT_PUBLIC_NATIVE_PUSH === "1";
export const nativePushAvailable = () => NATIVE_PUSH_ON && hasNativePlugin("PushNotifications");
