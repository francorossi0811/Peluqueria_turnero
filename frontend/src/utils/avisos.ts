/** ¿Avisa el backend por WhatsApp, o tiene que avisar el cliente desde su propio chat?
 *
 * Las dos formas existen y las dos son correctas, cada una en su momento:
 *
 * - **Apagado** (el default, y lo que usa Ariel hoy): el backend no tiene un número de
 *   WhatsApp conectado, así que al confirmar / cancelar / reprogramar se abre el chat del
 *   cliente con el mensaje ya escrito y él lo manda. Es el flujo de los links `wa.me`.
 * - **Encendido**: el backend manda el aviso solo por la Cloud API, y redirigir al cliente
 *   a WhatsApp sería pedirle que avise algo de lo que Ariel ya se enteró — además de
 *   parecer, para quien mire de afuera, que la app **no** envía nada.
 *
 * ⚠️ No apaga el botón "hablar con Ariel" de la pantalla de gestión (HU-03): ese no es un
 * aviso del turno, es contacto, y tiene que estar en los dos modos.
 *
 * Es una variable de build de Vite, así que cambiarla necesita un redeploy del frontend.
 */
export const WHATSAPP_AUTOMATICO =
  import.meta.env.VITE_WHATSAPP_AUTOMATICO === 'true'
