// Archivos dentro de la app nativa: el WebView no descarga archivos como un navegador, así que se guardan en la caché
// de la app y se abre la hoja de Compartir del sistema (Guardar en Archivos, Drive, correo). Solo dentro de la app.
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export async function shareTextFile(name: string, text: string, title: string) {
  const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
  await Share.share({ title, files: [uri] });
}
