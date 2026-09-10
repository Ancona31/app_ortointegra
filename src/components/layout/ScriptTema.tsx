/* ═══ EL TEMA, ESCRITO ANTES DEL PRIMER PINTADO ═══════════════════════════════
 *
 * Devuelve el <script> que lee `localStorage` y marca el <html> con la clase
 * `dark` antes de que el navegador pinte nada. Sin él, `ThemeProvider` la
 * escribe en un `useEffect` —o sea DESPUÉS del primer pintado— y cada carga se
 * ve primero en claro y luego salta a oscuro.
 *
 * ⚠️⚠️ ESTO NO VA EN EL LAYOUT RAÍZ, Y ESA ES SU RAZÓN DE SER. Estuvo ahí y fue
 * un error: el layout raíz lo comparten TODAS las rutas, incluidas las públicas
 * —`/pricing`, `/register`, las de contraseña, los legales—, que fijan su fondo
 * claro a mano y no tienen tema. Con la clase puesta, los bloques `html.dark`
 * de `globals.css` sí se les aplicaban —tokens y la hoja de traducción
 * ampliada— y salían con tinta y tintes oscuros sobre fondo claro.
 *
 * ⚠️ EL ALCANCE SE DECIDE POR ESTRUCTURA, NO POR UNA LISTA DE RUTAS. Lo monta
 * el layout que además monta un proveedor de tema, y hoy son dos: `(app)` y
 * `(launcher)`. La alternativa era que el script mirase `location.pathname`
 * contra una lista de rutas públicas, y esa lista se queda obsoleta la primera
 * vez que alguien añade una página sin acordarse de este archivo. Aquí no hay
 * nada que recordar: si un grupo de rutas gana tema, monta esto; si no, no.
 *
 * ⚠️ VA COMO PRIMER HIJO DEL LAYOUT. Es un <script> sin `async` ni `defer`, así
 * que el analizador se detiene y lo ejecuta antes de seguir con el árbol que
 * viene debajo — que es justo el que lleva color. No lo pases a `next/script`:
 * cualquier `strategy` lo difiere y el destello vuelve.
 *
 * ⚠️ `classList.add` Y NO `className =`: el <html> ya lleva `h-full`, y asignar
 * la clase entera lo borraría.
 *
 * ⚠️ EL `try` NO SOBRA: `localStorage` lanza en modo privado de algunos
 * navegadores y con cookies de terceros bloqueadas. Si lanza, la app arranca en
 * claro, que es el estado por defecto.
 */
export default function ScriptTema() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`,
      }}
    />
  )
}
