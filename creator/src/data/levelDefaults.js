export function createDefaultLevel() {
  return {
    id: 1,
    name: '',
    difficulty: '简单',
    startNode: -1,
    homeNode: -1,
    initialEnergy: 120,
    nodes: [],
    edges: [],
    food: [],
    wings: [],
    fastTravel: [],
    npcs: []
  }
}
