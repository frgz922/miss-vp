export const EVENT = {
  line1: process.env.NEXT_PUBLIC_EVENT_LINE1 || 'MISS VENEZUELA',
  line2: process.env.NEXT_PUBLIC_EVENT_LINE2 || 'PREMIUM',
  tagline: process.env.NEXT_PUBLIC_EVENT_TAGLINE || 'Belleza que inspira',
  finalists: Number(process.env.NEXT_PUBLIC_FINALISTS || 15),
  // Peso del voto del público en la puntuación final (0.2 = 20 %)
  publicVoteWeight: Number(process.env.NEXT_PUBLIC_PUBLIC_VOTE_WEIGHT || 0.2),
  minAge: 18,
  maxPhotos: 6,
};

export const CRITERIA = [
  { key: 'belleza', label: 'Belleza Física' },
  { key: 'presencia', label: 'Presencia Escénica' },
  { key: 'carisma', label: 'Carisma' },
  { key: 'comunicacion', label: 'Comunicación' },
  { key: 'actitud', label: 'Actitud' },
];

export const STATES = [
  'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo', 'Cojedes',
  'Delta Amacuro', 'Distrito Capital', 'Falcón', 'Guárico', 'La Guaira', 'Lara', 'Mérida',
  'Miranda', 'Monagas', 'Nueva Esparta', 'Portuguesa', 'Sucre', 'Táchira', 'Trujillo',
  'Yaracuy', 'Zulia',
];

export const STATUS = {
  pendiente: { label: 'Pendiente', cls: 'b-pend' },
  en_revision: { label: 'En revisión', cls: 'b-rev' },
  completado: { label: 'Completado', cls: 'b-ok' },
};
