export enum RoomType {
  LOBBY = 'lobby',
  PUBLIC = 'skyoffice',
  CUSTOM = 'custom',
}

export interface IRoomData {
  name: string
  description: string
  password: string | null
  autoDispose: boolean
}

// The selectable worlds. Each is a persistent public Colyseus room (registered
// on the server under `id`) rendered client-side by the generator/asset named in
// `map`. Everyone who picks the same world shares that world's room; different
// worlds are separate spaces. `id: 'skyoffice'` stays the default (back-compat).
export interface WorldInfo {
  id: string
  name: string
  description: string
  map: string
  emoji: string
}

export const WORLDS: WorldInfo[] = [
  {
    id: 'skyoffice',
    name: 'Meadow',
    description: 'Open grassland with ponds and shady groves — the classic Groupifier world.',
    map: 'meadow',
    emoji: '🌳',
  },
  {
    id: 'world_village',
    name: 'Village',
    description: 'A cluster of cottages and little gardens with a cosy small-town feel.',
    map: 'village',
    emoji: '🏡',
  },
  {
    id: 'world_island',
    name: 'Island',
    description: 'Sun, sand and sea — wander the beach island and meet fellow explorers.',
    map: 'island',
    emoji: '🏝️',
  },
  {
    id: 'world_cafe',
    name: 'Study Café',
    description: 'An indoor café full of tables — pull up a chair for a language exchange.',
    map: 'cafe',
    emoji: '☕',
  },
  {
    id: 'world_town',
    name: 'Town',
    description: 'City streets, shops and a roundabout — meet up downtown.',
    map: 'town',
    emoji: '🏙️',
  },
  {
    id: 'world_osaka',
    name: 'Osaka',
    description: 'A Japanese city crossroads — cherry trees, shops and neon, right off the street.',
    map: 'osaka',
    emoji: '🏮',
  },
]
