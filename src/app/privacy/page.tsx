import { redirect } from 'next/navigation'

/* `/privacy` YA NO PINTA NADA: el aviso tiene UNA sola ruta, `/privacidad`
   (privacidad 2026-12). Ésta se queda sólo para no romper los enlaces que ya
   andan por ahí —pie de la landing, login, ayuda, correos enviados— y los
   manda a la otra.

   ⚠️ Sigue en la lista de páginas públicas de `src/middleware.ts`, Y TIENE QUE
   SEGUIR: sin sesión, el middleware la mandaría a /login antes de llegar
   aquí, y un aviso de privacidad que pide iniciar sesión es justo lo que no
   puede pasar. No decide nada sobre la sesión: no es un guarda. */
export default function PrivacyPage(): never {
  redirect('/privacidad')
}
