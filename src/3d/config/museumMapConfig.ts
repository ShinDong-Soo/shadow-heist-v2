export type MuseumZoneId = 'ENTRANCE' | 'WEST_GALLERY' | 'SCULPTURE_HALL' | 'ARCHIVE' | 'SECURITY_CORRIDOR' | 'CROWN_HALL' | 'SERVICE_ROUTE';

export type GuardRouteProfile = {
  id: string;
  normal: readonly (readonly [number, number, number])[];
  alert: readonly (readonly [number, number, number])[];
  lockdown: {
    crown: readonly (readonly [number, number, number])[];
    west: readonly (readonly [number, number, number])[];
    exit: readonly (readonly [number, number, number])[];
  };
};

export const MUSEUM_MAP_CONFIG = {
  bounds: { minX: -9.5, maxX: 10.5, minZ: -51, maxZ: 8.7 },
  playerStart: [0, 0, -47] as const,
  exit: { position: [8.2, 0, -47.2] as const, radius: 1.15 },
  shortcutDoor: { x: 6.9, z: -18.5, width: 2.2 },
  zones: [
    { id: 'ENTRANCE', label: 'SERVICE ENTRANCE', centerZ: -46.5, minZ: -50.5, maxZ: -42.5 },
    { id: 'WEST_GALLERY', label: 'WEST GALLERY', centerZ: -37.5, minZ: -42.5, maxZ: -32.5 },
    { id: 'SCULPTURE_HALL', label: 'SCULPTURE HALL', centerZ: -27.5, minZ: -32.5, maxZ: -22.5 },
    { id: 'ARCHIVE', label: 'ARCHIVE', centerZ: -17.5, minZ: -22.5, maxZ: -12.5 },
    { id: 'SECURITY_CORRIDOR', label: 'SECURITY CORRIDOR', centerZ: -9, minZ: -12.5, maxZ: -5.5 },
    { id: 'CROWN_HALL', label: 'CROWN HALL', centerZ: 1.5, minZ: -5.5, maxZ: 8.7 },
    { id: 'SERVICE_ROUTE', label: 'SERVICE ESCAPE ROUTE', centerZ: -34, minZ: -50.5, maxZ: -18.5 },
  ] as const,
  guardA: {
    id: 'guard-alpha',
    normal: [
      [-3.8, 0, -40.5], [-3.8, 0, -35], [1.9, 0, -35], [4.3, 0, -33.5],
      [4.5, 0, -29.4], [1.8, 0, -27.6], [-4.6, 0, -28.4], [-4.5, 0, -32.8],
    ],
    alert: [
      [-4.2, 0, -39.5], [0, 0, -34], [4.5, 0, -29], [0, 0, -25],
      [-4.5, 0, -29], [0, 0, -34], [3.8, 0, -40], [0, 0, -43.5],
    ],
    lockdown: {
      crown: [[0, 0, -24], [4.5, 0, -28], [0, 0, -32]],
      west: [[0, 0, -32], [-4.2, 0, -37], [3.8, 0, -40], [0, 0, -43.5]],
      exit: [[0, 0, -43.5], [4.6, 0, -45], [7.8, 0, -47], [3.5, 0, -41]],
    },
  } satisfies GuardRouteProfile,
  guardB: {
    id: 'guard-bravo',
    normal: [
      [-3.2, 0, -20.8], [-5.7, 0, -20.8], [-5.7, 0, -15.4], [-5.7, 0, -20.8],
      [-3.2, 0, -20.8], [-3.2, 0, -13.5],
      [0, 0, -20.8], [0, 0, -13.5], [3.2, 0, -13.5], [3.2, 0, -20.8],
      [5.7, 0, -20.8], [5.7, 0, -13.5], [2.1, 0, -12.9], [2.1, 0, -8],
      [0, 0, -6.7], [-2.1, 0, -8], [-2.1, 0, -12.9],
    ],
    alert: [
      [0, 0, -6.8], [0, 0, -3.7], [-4.8, 0, -3.2], [-2.1, 0, -12.9],
      [-3.2, 0, -13.5], [-3.2, 0, -20.8], [0, 0, -20.8], [3.2, 0, -20.8],
      [3.2, 0, -13.5], [2, 0, -8],
    ],
    lockdown: {
      crown: [[0, 0, 3.2], [-3.5, 0, 5.4], [-4.8, 0, -3.2], [0, 0, -3.7]],
      west: [[0, 0, -6.8], [-2.1, 0, -12.9], [-3.2, 0, -13.5], [-3.2, 0, -20.8], [0, 0, -20.8]],
      exit: [[0, 0, -20.8], [3.2, 0, -20.8], [5.7, 0, -20.8], [6.2, 0, -18.5], [7.8, 0, -18.5], [8.2, 0, -28], [8.2, 0, -39]],
    },
  } satisfies GuardRouteProfile,
} as const;

export function museumZoneAt(x: number, z: number) {
  if (x > 6.7 && z < -18.3) return MUSEUM_MAP_CONFIG.zones.find(zone => zone.id === 'SERVICE_ROUTE')!;
  return MUSEUM_MAP_CONFIG.zones.find(zone => zone.id !== 'SERVICE_ROUTE' && z >= zone.minZ && z < zone.maxZ)
    ?? MUSEUM_MAP_CONFIG.zones[0];
}
