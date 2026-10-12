// Datos inventados para la demo — ningún nombre corresponde a una familia real.
import { getCategoryFromBirthDate } from '../lib/categoryUtils'
import { requiresBadge, requiresPager } from '../lib/categoryUtils'
import type { Category } from '../types/domain'

export type Row = Record<string, unknown>
export type Db = Record<string, Row[]>

const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001'

function id(prefix: string, n: number) {
  return `${prefix}${String(n).padStart(4, '0')}-0000-4000-8000-000000000000`.slice(0, 36)
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function birthDate(years: number, monthsExtra: number) {
  const d = new Date()
  d.setFullYear(d.getFullYear() - years)
  d.setMonth(d.getMonth() - monthsExtra)
  return ymd(d)
}

const FAMILIES: { parent: string; phone: string; kids: [string, number, number][] }[] = [
  { parent: 'Lucía Hernández', phone: '5521 3344', kids: [['Mateo Hernández', 8, 3], ['Valentina Hernández', 5, 1]] },
  { parent: 'Carlos Morales', phone: '4410 2290', kids: [['Sofía Morales', 11, 2]] },
  { parent: 'Andrea Castillo', phone: '3012 7781', kids: [['Diego Castillo', 6, 7], ['Camila Castillo', 3, 2], ['Emiliano Castillo', 1, 4]] },
  { parent: 'José Ramírez', phone: '5598 0012', kids: [['Isabella Ramírez', 9, 5]] },
  { parent: 'María Fernanda López', phone: '4765 1209', kids: [['Santiago López', 10, 1], ['Regina López', 7, 6]] },
  { parent: 'Roberto Pérez', phone: '3390 4456', kids: [['Ximena Pérez', 4, 9]] },
  { parent: 'Gabriela Méndez', phone: '5011 8834', kids: [['Sebastián Méndez', 12, 0], ['Renata Méndez', 8, 8]] },
  { parent: 'Luis Alvarado', phone: '4223 9071', kids: [['Daniela Alvarado', 2, 1]] },
  { parent: 'Patricia Orellana', phone: '5874 3320', kids: [['Nicolás Orellana', 6, 0], ['Mariana Orellana', 9, 10]] },
  { parent: 'Fernando Cifuentes', phone: '3165 2287', kids: [['Lucas Cifuentes', 3, 7]] },
  { parent: 'Karla Estrada', phone: '4590 6612', kids: [['Ana Paula Estrada', 10, 6], ['Joaquín Estrada', 5, 5]] },
  { parent: 'Miguel Ángel Barrios', phone: '5302 1178', kids: [['Valeria Barrios', 7, 2]] },
  { parent: 'Sandra Juárez', phone: '4877 0045', kids: [['Tomás Juárez', 1, 9], ['Elena Juárez', 4, 2]] },
  { parent: 'Héctor Solís', phone: '3233 5509', kids: [['Fernanda Solís', 11, 8]] },
  { parent: 'Claudia Rivas', phone: '5146 7723', kids: [['Gael Rivas', 8, 0], ['Luciana Rivas', 6, 4]] },
  { parent: 'Óscar Monterroso', phone: '4019 3367', kids: [['Martina Monterroso', 2, 8]] },
]

const ALLERGIES: Record<string, string> = {
  'Valentina Hernández': 'Maní',
  'Isabella Ramírez': 'Penicilina',
  'Lucas Cifuentes': 'Lácteos',
}
const NOTES: Record<string, string> = {
  'Diego Castillo': 'Asma leve, trae inhalador',
}

export function createSeed(): Db {
  const now = new Date()
  const today = ymd(now)
  const db: Db = {
    profiles: [
      { id: DEMO_USER_ID, full_name: 'Maestro de prueba', email: 'demo@ministerio.test', role: 'admin', active: true, is_owner: true, created_at: now.toISOString() },
      { id: id('p', 2), full_name: 'Raquel Gómez', email: 'raquel@ministerio.test', role: 'maestro', active: true, is_owner: false, created_at: now.toISOString() },
      { id: id('p', 3), full_name: 'Daniel Pineda', email: 'daniel@ministerio.test', role: 'maestro', active: true, is_owner: false, created_at: now.toISOString() },
      { id: id('p', 4), full_name: 'Ester Chávez', email: 'ester@ministerio.test', role: 'admin', active: true, is_owner: false, created_at: now.toISOString() },
    ],
    maestros: [
      ['Raquel', 'Gómez', 'rojo'], ['Daniel', 'Pineda', 'rojo'], ['Ester', 'Chávez', 'amarillo'],
      ['Samuel', 'Xicará', 'amarillo'], ['Rut', 'Batres', 'azul'], ['Abigail', 'Coronado', 'azul'],
    ].map(([nombre, apellido, team], i) => ({
      id: id('m', i + 1), nombre, apellido, team_color: team, discipulador: null, fecha_nacimiento: null, dpi: null,
      celular: null, tiempo_asistencia: null, bautizado_aguas: null, bautizado_espiritu: null, profesion: null,
      photo_url: null, created_at: now.toISOString(),
    })),
    parents: [],
    children: [],
    attendance: [],
    child_contacts: [],
    shift_notes: [],
    coordinator_requests: [],
    daily_coordinator: [{ session_date: today, name: 'Ester Chávez', set_by: DEMO_USER_ID }],
    daily_computer_operator: [],
    activity_log: [],
    deletion_log: [],
  }

  let childN = 0
  FAMILIES.forEach((f, fi) => {
    const parentId = id('f', fi + 1)
    db.parents.push({ id: parentId, full_name: f.parent, phone: f.phone, photo_url: null, created_at: now.toISOString(), deleted_at: null, deleted_by: null })
    for (const [name, years, months] of f.kids) {
      childN++
      const bd = birthDate(years, months)
      db.children.push({
        id: id('c', childN), parent_id: parentId, full_name: name, birth_date: bd,
        category: getCategoryFromBirthDate(bd), allergies: ALLERGIES[name] ?? null, medical_notes: NOTES[name] ?? null,
        guardian_relationship: fi % 3 === 0 ? 'mama' : null, comments: null,
        toilet_trained: years <= 4 ? years >= 3 : null, photo_url: null,
        assigned_maestro_id: years <= 4 ? id('m', (childN % 6) + 1) : null, assigned_maestro_name: null,
        created_at: now.toISOString(), deleted_at: null, deleted_by: null,
      })
    }
  })

  // Historial de los últimos domingos (para Reportes) y unos cuantos ya
  // registrados hoy (para ver la lista de "Registrados hoy").
  const teams = ['rojo', 'amarillo', 'azul']
  for (let w = 6; w >= 0; w--) {
    const d = new Date(now)
    d.setDate(d.getDate() - w * 7)
    const date = ymd(d)
    const badges: Partial<Record<Category, number>> = {}
    db.children.forEach((c, i) => {
      const goes = w === 0 ? i % 4 === 0 : (i + w) % 3 !== 0
      if (!goes) return
      const cat = c.category as Category
      const badge = requiresBadge(cat) ? (badges[cat] = (badges[cat] ?? 0) + 1) : null
      const t = new Date(d); t.setHours(9, 5 + (i % 40), 0, 0)
      db.attendance.push({
        id: id('a', w * 100 + i), child_id: c.id, session_date: date, team_color: teams[w % 3], category: cat,
        badge_number: badge, pager_number: requiresPager(cat) && i % 2 === 0 ? i + 1 : null,
        checked_in_at: t.toISOString(), checked_out_at: w === 0 ? null : t.toISOString(),
        assigned_teacher_id: null, deleted_at: null, deleted_by: null,
      })
    })
  }

  db.shift_notes.push({
    id: id('n', 1), session_date: today, team_color: 'rojo', note: 'Mateo se portó muy bien ayudando a repartir el material.',
    child_id: id('c', 1), author_id: id('p', 2), created_at: now.toISOString(),
  })
  db.coordinator_requests.push({
    id: id('r', 1), message: 'Por favor agregar a Pablo Gutiérrez (5 años), viene con su tía Marta, tel. 5512 9087.',
    status: 'pendiente', author_id: id('p', 3), created_at: now.toISOString(), resolved_at: null, resolved_by: null, seen_by_author: false,
  })
  return db
}
