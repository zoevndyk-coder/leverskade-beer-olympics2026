const KEY = "state-v1";

const DEFAULT_GAMES = [
  "Flip Cup",
  "Rage Cage Battle",
  "Flunkyball",
  "Cornhole",
  "Kubb",
  "Frisbee",
  "Tug of War",
  "Darts",
  "Pétanque",
  "Trick Shots",
];

const DEFAULT_NAMES = [
  "Yoyo", "Brett", "Mete", "Djibril", "Ram", "Lyla", "Milan", "Tonia",
  "Gabriel", "Carlos", "De Juan", "Tony", "Mayan", "Freya", "Christ",
  "Tayfun", "John", "Chin", "Abhi", "Mio", "Reyna", "Miguel", "Vlad",
  "Beth", "New", "Dia", "Okieve",
];

function makeId(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// Scores are keyed by game name, so a rename would orphan them. Move any
// scores stored under an old name across to the new one.
const RENAMED_GAMES = {
  "Rage Cage": "Rage Cage Battle",
};

function migrateGameNames(state) {
  const scores = { ...state.scores };
  let touched = false;
  for (const pid of Object.keys(scores)) {
    const row = { ...scores[pid] };
    for (const [oldName, newName] of Object.entries(RENAMED_GAMES)) {
      if (row[oldName] !== undefined) {
        row[newName] = (row[newName] || 0) + row[oldName];
        delete row[oldName];
        touched = true;
      }
    }
    scores[pid] = row;
  }
  return touched ? { ...state, scores } : state;
}

function defaultState() {
  return {
    participants: DEFAULT_NAMES.map((name, i) => ({
      id: `p${i}`,
      name,
      note: name === "Milan" ? "Arrives day 2" : "",
    })),
    games: DEFAULT_GAMES,
    scores: {},
    teams: [],
    tournament: null, // { matches: [...] }
    rev: 0,
  };
}

/* ============================ TOURNAMENT ============================

   Format: Swiss group rounds, then a seeded knockout.

   Group stage
     - The whole round is drawn at once, so all pairings are known and
       matches can be played in any order, on as many tables as you like.
     - Round 1 is a random draw. Later rounds rank teams by record and pair
       neighbours, so winners meet winners and losers meet losers.
     - Nobody plays the same opponent twice.
     - Odd number of teams: one team sits out each round (counts as a win),
       rotating so the same team doesn't sit out repeatedly.

   Knockout
     - Top teams by group record advance (8, 4, or 2 depending on entries).
     - Seeded 1-v-last, single elimination, down to the final.

   Design rule that keeps this simple: recording a result NEVER redraws or
   deletes anything. Fixing a mistake just updates that one result. Rounds
   already drawn stay as they are — exactly like a real tournament.
==================================================================== */

const MATCH = (a, b) => ({
  id: makeId("m"),
  teamAId: a,
  teamBId: b,
  winnerId: null,
  isBye: false,
});

const BYE = (a) => ({
  id: makeId("m"),
  teamAId: a,
  teamBId: null,
  winnerId: a,
  isBye: true,
});

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function groupRounds(state) {
  return state.tournament?.rounds || [];
}

function allGroupMatches(state) {
  return groupRounds(state).flat();
}

function knockoutRounds(state) {
  return state.tournament?.knockout?.rounds || [];
}

function findMatch(state, matchId) {
  return (
    allGroupMatches(state).find((m) => m.id === matchId) ||
    knockoutRounds(state).flat().find((m) => m.id === matchId) ||
    null
  );
}

function standingsFor(state) {
  const row = {};
  for (const t of state.teams) {
    row[t.id] = { teamId: t.id, name: t.name, wins: 0, losses: 0, played: 0, byes: 0 };
  }
  for (const m of allGroupMatches(state)) {
    if (m.isBye) {
      const r = row[m.teamAId];
      if (r) { r.byes++; r.wins++; r.played++; }
      continue;
    }
    if (!m.winnerId) continue;
    const loser = m.winnerId === m.teamAId ? m.teamBId : m.teamAId;
    if (row[m.winnerId]) { row[m.winnerId].wins++; row[m.winnerId].played++; }
    if (row[loser]) { row[loser].losses++; row[loser].played++; }
  }
  return Object.values(row).sort(
    (a, b) => b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name)
  );
}

function roundComplete(round) {
  return round.length > 0 && round.every((m) => m.isBye || m.winnerId);
}

// Maximum rounds possible without anyone repeating an opponent.
function maxGroupRounds(teamCount) {
  return Math.max(1, teamCount - 1);
}

function groupTarget(state) {
  return state.tournament?.groupRounds ?? 3;
}

function groupStageComplete(state) {
  const rounds = groupRounds(state);
  return rounds.length >= groupTarget(state) && rounds.every(roundComplete);
}

/* --- pairing ---
   Takes an ordered list of team ids (best first) and returns pairs,
   preferring neighbours but never repeating a past opponent. Uses
   backtracking, and always returns a complete pairing: if repeats are
   unavoidable it allows them rather than failing.                     */
function pairTeams(order, playedSet) {
  const solved = [];

  const search = (pool) => {
    if (pool.length === 0) return true;
    const a = pool[0];
    for (let i = 1; i < pool.length; i++) {
      const b = pool[i];
      if (playedSet.has(pairKey(a, b))) continue;
      solved.push([a, b]);
      if (search(pool.filter((_, k) => k !== 0 && k !== i))) return true;
      solved.pop();
    }
    return false;
  };

  if (search(order)) return solved;

  const pairs = [];
  const pool = [...order];
  while (pool.length >= 2) pairs.push([pool.shift(), pool.shift()]);
  return pairs;
}

function pairKey(a, b) {
  return [a, b].sort().join("|");
}

function playedSetOf(state) {
  const set = new Set();
  for (const m of allGroupMatches(state)) {
    if (!m.isBye) set.add(pairKey(m.teamAId, m.teamBId));
  }
  return set;
}

function drawGroupRound(state) {
  const rounds = groupRounds(state);
  const table = standingsFor(state);

  let order =
    rounds.length === 0
      ? shuffle(state.teams).map((t) => t.id)
      : table.map((r) => r.teamId);

  const round = [];

  if (order.length % 2 === 1) {
    const byeCount = Object.fromEntries(table.map((r) => [r.teamId, r.byes]));
    // Lowest-ranked team that has sat out least often.
    let byeId = order[order.length - 1];
    for (let i = order.length - 1; i >= 0; i--) {
      if ((byeCount[order[i]] || 0) < (byeCount[byeId] || 0)) byeId = order[i];
    }
    order = order.filter((id) => id !== byeId);
    round.push(BYE(byeId));
  }

  for (const [a, b] of pairTeams(order, playedSetOf(state))) {
    round.push(MATCH(a, b));
  }
  return round;
}

/* --- knockout --- */

function knockoutSize(teamCount) {
  if (teamCount >= 8) return 8;
  if (teamCount >= 4) return 4;
  return 2;
}

function drawKnockout(state) {
  const size = Math.min(knockoutSize(state.teams.length), state.teams.length);
  const seeds = standingsFor(state).slice(0, size).map((r) => r.teamId);
  const round = [];
  for (let i = 0; i < Math.floor(size / 2); i++) {
    round.push(MATCH(seeds[i], seeds[size - 1 - i]));
  }
  return { size, rounds: [round] };
}

function drawNextKnockoutRound(ko) {
  const rounds = ko.rounds;
  const last = rounds[rounds.length - 1];
  if (last.length <= 1) return ko;              // final already drawn
  if (!last.every((m) => m.winnerId)) return ko; // not finished yet
  const winners = last.map((m) => m.winnerId);
  const next = [];
  for (let i = 0; i < winners.length; i += 2) {
    next.push(MATCH(winners[i], winners[i + 1]));
  }
  return { ...ko, rounds: [...rounds, next] };
}

function tournamentChampion(state) {
  const rounds = knockoutRounds(state);
  if (!rounds.length) return null;
  const last = rounds[rounds.length - 1];
  return last.length === 1 && last[0].winnerId ? last[0].winnerId : null;
}

/* ---------------- action reducer ---------------- */

function applyAction(state, action) {
  const s = {
    ...state,
    scores: { ...state.scores },
    participants: [...state.participants],
    teams: [...state.teams],
  };

  switch (action.type) {
    case "adjustScore": {
      const { participantId, game, delta } = action;
      const p = { ...(s.scores[participantId] || {}) };
      p[game] = Math.max(0, (p[game] || 0) + (delta || 0));
      s.scores[participantId] = p;
      break;
    }
    case "addParticipant": {
      const name = String(action.name || "").trim();
      if (name) s.participants.push({ id: makeId("p"), name, note: "" });
      break;
    }
    case "removeParticipant": {
      s.participants = s.participants.filter((p) => p.id !== action.id);
      break;
    }
    case "addTeam": {
      const players = (action.playerNames || []).filter(Boolean);
      if (players.length) {
        const name = String(action.name || "").trim() || players.join(" & ");
        s.teams.push({ id: makeId("t"), name, playerNames: players });
      }
      break;
    }
    case "removeTeam": {
      s.teams = s.teams.filter((t) => t.id !== action.id);
      break;
    }
    case "startTournament": {
      if (s.teams.length >= 2) {
        const asked = Math.max(1, Number(action.groupRounds) || 3);
        s.tournament = {
          phase: "group",
          groupRounds: Math.min(maxGroupRounds(s.teams.length), asked),
          rounds: [],
          knockout: null,
        };
        s.tournament = { ...s.tournament, rounds: [drawGroupRound(s)] };
      }
      break;
    }

    // Recording a result only ever writes that one winner. Nothing is
    // redrawn or discarded, so corrections are always safe.
    case "setMatchWinner": {
      if (!s.tournament) break;
      const target = findMatch(s, action.matchId);
      if (!target || target.isBye) break;
      if (![target.teamAId, target.teamBId].includes(action.winnerId)) break;

      const inGroup = allGroupMatches(s).some((m) => m.id === action.matchId);

      if (inGroup) {
        s.tournament = {
          ...s.tournament,
          rounds: groupRounds(s).map((r) =>
            r.map((m) => (m.id === action.matchId ? { ...m, winnerId: action.winnerId } : m))
          ),
        };
        // Draw the next round as soon as this one is finished.
        const rounds = groupRounds(s);
        if (
          roundComplete(rounds[rounds.length - 1]) &&
          rounds.length < groupTarget(s)
        ) {
          s.tournament = { ...s.tournament, rounds: [...rounds, drawGroupRound(s)] };
        }
      } else {
        let ko = {
          ...s.tournament.knockout,
          rounds: s.tournament.knockout.rounds.map((r) =>
            r.map((m) => (m.id === action.matchId ? { ...m, winnerId: action.winnerId } : m))
          ),
        };
        ko = drawNextKnockoutRound(ko);
        s.tournament = { ...s.tournament, knockout: ko };
      }
      break;
    }

    case "drawNextRound": {
      if (s.tournament?.phase === "group") {
        const rounds = groupRounds(s);
        if (
          rounds.length &&
          roundComplete(rounds[rounds.length - 1]) &&
          rounds.length < groupTarget(s)
        ) {
          s.tournament = { ...s.tournament, rounds: [...rounds, drawGroupRound(s)] };
        }
      }
      break;
    }

    case "startKnockout": {
      if (s.tournament?.phase === "group" && groupStageComplete(s)) {
        s.tournament = { ...s.tournament, phase: "knockout", knockout: drawKnockout(s) };
      }
      break;
    }

    case "backToGroup": {
      if (s.tournament?.phase === "knockout") {
        s.tournament = { ...s.tournament, phase: "group", knockout: null };
      }
      break;
    }
    case "resetTournament": {
      s.tournament = null;
      break;
    }
    default:
      break;
  }

  s.rev = (state.rev || 0) + 1;
  return s;
}

/* ---------------- handler ---------------- */

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: JSON_HEADERS });
  }

  try {
    let getStore;
    try {
      ({ getStore } = await import("@netlify/blobs"));
    } catch (e) {
      return json(
        { error: "Could not load the database library: " + String(e && e.message) },
        500
      );
    }

    let store;
    try {
      // "strong" makes reads return the very latest write. Without it a
      // read can briefly return an older copy, which made scores appear
      // to vanish and then come back a few seconds later.
      store = getStore({ name: "beer-olympics", consistency: "strong" });
    } catch (e) {
      return json({ error: "Could not open the database: " + String(e && e.message) }, 500);
    }

    const readState = async () => {
      const raw = await store.get(KEY, { consistency: "strong" });
      if (!raw) return defaultState();
      let saved;
      try {
        saved = JSON.parse(raw);
      } catch (e) {
        return defaultState();
      }
      const state = { ...defaultState(), ...saved };
      // The game list always comes from the code, never from saved data —
      // otherwise renaming a game leaves the old name stuck in the database.
      state.games = DEFAULT_GAMES;
      return migrateGameNames(state);
    };

    if (req.method === "GET") {
      return json(await readState());
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const actions = body.actions || (body.action ? [body.action] : []);
      if (!actions.length) return json({ error: "No action provided" }, 400);

      let state = await readState();
      for (const a of actions) state = applyAction(state, a);
      await store.set(KEY, JSON.stringify(state));

      return json(state);
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    return json({ error: String((err && err.message) || err) }, 500);
  }
};

export const config = {
  path: "/api/storage",
};
