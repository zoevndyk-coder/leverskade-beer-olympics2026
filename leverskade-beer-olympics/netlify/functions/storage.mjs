const KEY = "state-v1";

const DEFAULT_GAMES = [
  "Flip Cup",
  "Rage Cage",
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
    tournament: null, // { rounds: [ { matches: [...] } ] }
    rev: 0,
  };
}

/* ---------------- tournament (Swiss style) ----------------
   Every team plays every round — no byes unless the team count
   is odd, in which case exactly one team sits out per round and
   never sits out twice before everyone else has.
   After round 1, teams are ranked by wins and paired with the
   closest-ranked opponent they haven't already played, so the
   strong teams meet the strong and the weak meet the weak.
----------------------------------------------------------- */

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function standingsFor(state) {
  const table = {};
  for (const t of state.teams) {
    table[t.id] = { teamId: t.id, name: t.name, wins: 0, losses: 0, played: 0, byes: 0 };
  }
  const rounds = state.tournament?.rounds || [];
  for (const round of rounds) {
    for (const m of round.matches) {
      if (m.isBye) {
        if (table[m.teamAId]) {
          table[m.teamAId].byes += 1;
          table[m.teamAId].wins += 1; // a bye counts as a free win
        }
        continue;
      }
      if (!m.winnerId) continue;
      const loserId = m.winnerId === m.teamAId ? m.teamBId : m.teamAId;
      if (table[m.winnerId]) {
        table[m.winnerId].wins += 1;
        table[m.winnerId].played += 1;
      }
      if (table[loserId]) {
        table[loserId].losses += 1;
        table[loserId].played += 1;
      }
    }
  }
  return Object.values(table).sort(
    (a, b) => b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name)
  );
}

function alreadyPlayed(state, aId, bId) {
  const rounds = state.tournament?.rounds || [];
  for (const round of rounds) {
    for (const m of round.matches) {
      if (m.isBye) continue;
      if (
        (m.teamAId === aId && m.teamBId === bId) ||
        (m.teamAId === bId && m.teamBId === aId)
      ) {
        return true;
      }
    }
  }
  return false;
}

function roundIsComplete(round) {
  return round.matches.every((m) => m.isBye || m.winnerId);
}

function buildRound(state, roundNumber) {
  let order;
  if (roundNumber === 0) {
    order = shuffle(state.teams).map((t) => t.id);
  } else {
    order = standingsFor(state).map((s) => s.teamId);
  }

  const matches = [];
  const pool = [...order];

  // Odd team count: give the bye to the lowest-ranked team that has had
  // the fewest byes so far.
  if (pool.length % 2 === 1) {
    const byeCounts = {};
    for (const s of standingsFor(state)) byeCounts[s.teamId] = s.byes;
    let byeId = null;
    for (let i = pool.length - 1; i >= 0; i--) {
      const id = pool[i];
      if (byeId === null || (byeCounts[id] || 0) < (byeCounts[byeId] || 0)) {
        byeId = id;
      }
    }
    pool.splice(pool.indexOf(byeId), 1);
    matches.push({
      id: makeId("m"),
      teamAId: byeId,
      teamBId: null,
      winnerId: byeId,
      isBye: true,
    });
  }

  // Pair neighbours in the ranking, skipping ahead when that pairing
  // would be a repeat of a match they've already played.
  while (pool.length > 0) {
    const a = pool.shift();
    let idx = 0;
    while (idx < pool.length - 1 && alreadyPlayed(state, a, pool[idx])) idx++;
    const b = pool.splice(idx, 1)[0];
    matches.push({
      id: makeId("m"),
      teamAId: a,
      teamBId: b,
      winnerId: null,
      isBye: false,
    });
  }

  return { matches };
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
        s.tournament = { rounds: [] };
        s.tournament.rounds.push(buildRound(s, 0));
      }
      break;
    }
    case "nextRound": {
      const rounds = s.tournament?.rounds || [];
      if (rounds.length && roundIsComplete(rounds[rounds.length - 1])) {
        s.tournament = {
          ...s.tournament,
          rounds: [...rounds, buildRound(s, rounds.length)],
        };
      }
      break;
    }
    case "setMatchWinner": {
      const rounds = s.tournament?.rounds;
      if (rounds && rounds[action.roundIdx]) {
        const newRounds = rounds.map((r, ri) =>
          ri !== action.roundIdx
            ? r
            : {
                ...r,
                matches: r.matches.map((m, mi) =>
                  mi === action.matchIdx ? { ...m, winnerId: action.winnerId } : m
                ),
              }
        );
        // Changing an earlier result invalidates later rounds, since they
        // were paired from standings that have now changed.
        s.tournament = { ...s.tournament, rounds: newRounds.slice(0, action.roundIdx + 1) };
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
      try {
        return { ...defaultState(), ...JSON.parse(raw) };
      } catch (e) {
        return defaultState();
      }
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
