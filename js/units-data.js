// ---------------------------------------------------------------------------
// DevWars: Market & Military - army unit definitions
// income = coins generated per minute; upkeep = coins consumed per minute.
// ---------------------------------------------------------------------------

export const UNITS = [
  {
    id: "junior",
    name: "Junior Dev",
    cost: 50,
    atk: 2,
    def: 1,
    upkeep: 1,
    income: 0,
    icon: "user",
    description: "Cheap and enthusiastic. Writes code that mostly works. Mostly.",
  },
  {
    id: "senior",
    name: "Senior Dev",
    cost: 300,
    atk: 10,
    def: 5,
    upkeep: 5,
    income: 0,
    icon: "terminal",
    description: "Veteran problem solver. High attack power in code reviews.",
  },
  {
    id: "devops",
    name: "DevOps Engineer",
    cost: 200,
    atk: 1,
    def: 15,
    upkeep: 3,
    income: 0,
    icon: "server",
    description: "Keeps the pipelines running and the firewalls standing. Pure defense.",
  },
  {
    id: "bot",
    name: "Build Bot",
    cost: 500,
    atk: 0,
    def: 0,
    upkeep: 2,
    income: 5,
    icon: "bot",
    description: "Automated worker that prints DevCoins around the clock.",
  },
];

export function unitById(id) {
  return UNITS.find((u) => u.id === id) || null;
}

export default UNITS;
