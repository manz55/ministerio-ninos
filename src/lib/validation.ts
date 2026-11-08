// Revisiones de los datos que escriben los maestros, las mismas en todos los
// formularios. Cada una devuelve el mensaje de error, o null si está bien.

const LOWER_WORDS = new Set(['de', 'del', 'la', 'las', 'los', 'y'])

/** "  maría  de los ángeles " → "María de los Ángeles". */
export function tidyName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w, i) => {
      const lower = w.toLocaleLowerCase('es')
      if (i > 0 && LOWER_WORDS.has(lower)) return lower
      // Mayúscula al inicio y después de guion o apóstrofo: José-Luis, O'Neil.
      return lower.replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase('es'))
    })
    .join(' ')
}

/** Nombre completo de un niño, papá o usuario: nombre y apellido, sin números. */
export function fullNameError(name: string): string | null {
  const clean = name.trim().replace(/\s+/g, ' ')
  if (!clean) return 'Escribe el nombre.'
  if (/\d/.test(clean)) return 'El nombre no puede llevar números.'
  if (!/^[\p{L}][\p{L}'’.\- ]*$/u.test(clean)) return 'El nombre solo puede llevar letras.'
  const words = clean.split(' ').filter((w) => w.replace(/[.'’-]/g, '').length >= 2)
  if (words.length < 2) return 'Escribe nombre y apellido.'
  return null
}

/** Un solo nombre o apellido (formulario de Maestros). */
export function namePartError(value: string, what: 'nombre' | 'apellido'): string | null {
  const clean = value.trim()
  if (!clean) return `Escribe el ${what}.`
  if (/\d/.test(clean)) return `El ${what} no puede llevar números.`
  if (!/^[\p{L}][\p{L}'’.\- ]*$/u.test(clean) || clean.replace(/[^\p{L}]/gu, '').length < 2) return `Revisa el ${what}.`
  return null
}

/** Teléfono de Guatemala: 8 números (se aceptan espacios, guiones y +502). */
export function phoneError(phone: string, required: boolean): string | null {
  const clean = phone.trim()
  if (!clean) return required ? 'Escribe el teléfono.' : null
  if (/[^\d\s\-+()]/.test(clean)) return 'El teléfono solo puede llevar números.'
  let digits = clean.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('502')) digits = digits.slice(3)
  if (digits.length !== 8) return 'El teléfono debe tener 8 números.'
  return null
}

/** "5521-3344", "55213344" o "+502 5521 3344" → "5521 3344". */
export function tidyPhone(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('502')) digits = digits.slice(3)
  return digits.length === 8 ? `${digits.slice(0, 4)} ${digits.slice(4)}` : phone.trim()
}

/** Fecha de nacimiento de un niño: no en el futuro ni de más de 18 años. */
export function birthDateError(date: string, required: boolean): string | null {
  if (!date) return required ? 'Escribe la fecha de nacimiento.' : null
  const d = new Date(date + 'T12:00:00')
  if (isNaN(d.getTime())) return 'Revisa la fecha.'
  const now = new Date()
  if (d > now) return 'La fecha no puede ser en el futuro.'
  const limit = new Date(now); limit.setFullYear(now.getFullYear() - 18)
  if (d < limit) return 'Revisa la fecha: es de hace más de 18 años.'
  return null
}

// Encargados del domingo: a veces son dos personas ("Laura Marroquín -
// Karen Natareno", "Natalia Parra/Jenny Tay"). Cada una con nombre y apellido.
const STAFF_SEPARATOR = /\s+-\s+|\s*[/,&]\s*|\s+y\s+/i

export function staffNameError(name: string): string | null {
  const people = name.trim().split(STAFF_SEPARATOR).filter((p) => p.trim())
  if (people.length === 0) return 'Escribe el nombre.'
  for (const person of people) {
    const err = fullNameError(person)
    if (err === 'Escribe nombre y apellido.') return people.length > 1 ? 'Escribe nombre y apellido de cada persona.' : 'Escribe nombre y apellido, no solo el nombre.'
    if (err) return err
  }
  return null
}

/** "laura marroquín-karen" → "Laura Marroquín / Karen Natareno" ya acomodado. */
export function tidyStaffName(name: string): string {
  return name.trim().split(STAFF_SEPARATOR).filter((p) => p.trim()).map(tidyName).join(' / ')
}
