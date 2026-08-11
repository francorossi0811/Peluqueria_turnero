// Acceso a la agenda de contactos del dispositivo, para que Ariel no tenga que tipear el
// teléfono de un cliente que ya tiene guardado.
//
// ⚠️ El Contact Picker API existe **solo en Chrome sobre Android** (desde Chrome 80, y
// pide Android 6 o más nuevo). No está en Chrome de escritorio, ni en Samsung Internet,
// ni en ningún navegador de iPhone. Por eso todo esto es una comodidad opcional y nunca
// el único camino: el teléfono es un campo opcional que también se puede tipear, que es
// lo que va a pasar en la computadora del mostrador.

interface ContactoElegido {
  nombre?: string
  telefono?: string
}

interface ContactsManagerLike {
  select: (
    propiedades: string[],
    opciones?: { multiple?: boolean },
  ) => Promise<{ name?: string[]; tel?: string[] }[]>
}

function gestorDeContactos(): ContactsManagerLike | null {
  const nav = navigator as Navigator & { contacts?: ContactsManagerLike }
  // Se chequean las dos cosas porque en algunas versiones existe `navigator.contacts`
  // (de una API vieja y distinta) sin el ContactsManager que nos interesa.
  if (!('contacts' in navigator) || !('ContactsManager' in window)) return null
  return nav.contacts ?? null
}

/** Si es `false`, no hay que mostrar el botón: no existe ningún fallback que ofrecer. */
export function soportaElegirContacto(): boolean {
  return gestorDeContactos() !== null
}

/** Abre el selector nativo. Devuelve `null` si el usuario cerró sin elegir.
 *
 * Tiene que llamarse desde el handler de un click: el navegador exige un gesto del
 * usuario y rechaza el pedido si no lo hay. */
export async function elegirContacto(): Promise<ContactoElegido | null> {
  const contactos = gestorDeContactos()
  if (!contactos) return null

  const elegidos = await contactos.select(['name', 'tel'], { multiple: false })
  const primero = elegidos[0]
  if (!primero) return null

  return {
    nombre: primero.name?.[0],
    // Un contacto puede tener varios números; se toma el primero, que es el principal.
    telefono: primero.tel?.[0],
  }
}
