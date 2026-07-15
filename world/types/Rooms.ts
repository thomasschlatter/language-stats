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
    id: 'world_island',
    name: 'Island',
    description: 'Sun, sand and sea. Wander the beach island and meet fellow explorers.',
    map: 'island',
    emoji: '🏝️',
  },
  {
    id: 'world_town',
    name: 'Town',
    description: 'City streets, shops and traffic. Meet up downtown.',
    map: 'town',
    emoji: '🏙️',
  },
  {
    id: 'world_cafe',
    name: 'Office',
    description: 'An indoor office with desks and meeting spots. Pull up a chair for a language exchange.',
    map: 'cafe',
    emoji: '🏢',
  },
  {
    id: 'world_osaka',
    name: 'Osaka',
    description: 'A Japanese city crossroads with cherry trees, shops and neon, right off the street.',
    map: 'osaka',
    emoji: '🏮',
  },
  {
    id: 'world_room',
    name: 'Room',
    description: 'A simple empty room with four solid walls — a starter indoor space.',
    map: 'room',
    emoji: '🚪',
  },
  {
    id: 'world_border',
    name: 'Apartment',
    description: 'A wallpapered floating apartment split into two rooms by an inner wall and doorway.',
    map: 'border',
    emoji: '🏠',
  },
]
