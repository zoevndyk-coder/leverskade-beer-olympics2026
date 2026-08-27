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
    tournament: null, // { matches: [...] }
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

/* -------- tournament: group stage, then knockout --------
   Phase 1 "group": every team plays GROUP_GAMES matches. Pairing is
   continuous — the moment two teams are free they're matched on record,
   so nobody waits for a round to finish. No rematches.
   Phase 2 "knockout": the top teams advance (8, 4 or 2 depending on how
   many teams there are), seeded by group record. Lose and you're out.
--------------------------------------------------------- */

function groupMatches(state) {
  return (state.tournament?.matches || []).filter((m) => m.phase === "group");
}

function knockoutRounds(state) {
  return state.tournament?.knockout?.rounds || [];
}

function standingsFor(state) {
  const table = {};
  for (const t of state.teams) {
    table[t.id] = { teamId: t.id, name: t.name, wins: 0, losses: 0, played: 0 };
  }
  for (const m of groupMatches(state)) {
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
  return Object.values(table).sort(
    (a, b) => b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name)
  );
}

function alreadyPlayed(state, aId, bId) {
  for (const m of state.tournament?.matches || []) {
    if (
      (m.teamAId === aId && m.teamBId === bId) ||
      (m.teamAId === bId && m.teamBId === aId)
    ) {
      return true;
    }
  }
  return false;
}

function busyTeamIds(state) {
  const busy = new Set();
  for (const m of state.tournament?.matches || []) {
    if (!m.winnerId) {
      busy.add(m.teamAId);
      busy.add(m.teamBId);
    }
  }
  return busy;
}

// How many teams go through to the knockout stage.
function knockoutSize(teamCount) {
  if (teamCount >= 8) return 8;
  if (teamCount >= 4) return 4;
  return 2;
}

// The group stage is done when nothing is still being played and no further
// match can be scheduled. (With an odd number of teams one team can end up a
// match short — that's unavoidable, since the total number of match slots
// has to be even.)
function groupStageComplete(state) {
  const pending = groupMatches(state).some((m) => !m.winnerId);
  if (pending) return false;
  const before = groupMatches(state).length;
  const after = pairWaitingTeams(state).matches.filter((m) => m.phase === "group").length;
  return after === before;
}

// Continuous pairing for the group stage.
function pairWaitingTeams(state) {
  const target = state.tournament?.groupGames ?? 3;
  const matches = [...(state.tournament?.matches || [])];
  const table = standingsFor(state);
  const busy = busyTeamIds(state);

  // Count matches already scheduled (not just finished) so a team never
  // gets booked beyond its quota.
  const scheduled = {};
  for (const t of state.teams) scheduled[t.id] = 0;
  for (const m of matches) {
    if (m.phase !== "group") continue;
    if (scheduled[m.teamAId] !== undefined) scheduled[m.teamAId] += 1;
    if (scheduled[m.teamBId] !== undefined) scheduled[m.teamBId] += 1;
  }

  // Free teams that still owe matches, fewest-scheduled first so the field
  // stays roughly level, then by record so winners meet winners.
  let free = table
    .filter((r) => !busy.has(r.teamId))
    .filter((r) => (scheduled[r.teamId] ?? 0) < target)
    .sort(
      (a, b) =>
        (scheduled[a.teamId] ?? 0) - (scheduled[b.teamId] ?? 0) ||
        b.wins - a.wins ||
        a.losses - b.losses
    )
    .map((r) => r.teamId);

  let working = state;
  while (free.length >= 2) {
    const a = free.shift();
    // Prefer someone they haven't played; fall back to a rematch rather
    // than letting the group stage stall with matches still owed.
    let idx = free.findIndex((b) => !alreadyPlayed(working, a, b));
    if (idx === -1) idx = 0;
    const b = free.splice(idx, 1)[0];
    matches.push({
      id: makeId("m"),
      teamAId: a,
      teamBId: b,
      winnerId: null,
      phase: "group",
    });
    working = { ...working, tournament: { ...working.tournament, matches } };
  }

  return { ...state.tournament, matches };
}

// Builds the first knockout round from the group standings, seeded so the
// best team faces the worst qualifier.
function buildKnockout(state) {
  const size = Math.min(knockoutSize(state.teams.length), state.teams.length);
  const seeds = standingsFor(state).slice(0, size).map((r) => r.teamId);
  const round = [];
  for (let i = 0; i < size / 2; i++) {
    round.push({
      id: makeId("m"),
      teamAId: seeds[i],
      teamBId: seeds[size - 1 - i],
      winnerId: null,
      phase: "knockout",
    });
  }
  return { rounds: [round], size };
}

function knockoutNextRound(state) {
  const rounds = knockoutRounds(state);
  if (!rounds.length) return state.tournament.knockout;
  const last = rounds[rounds.length - 1];
  if (!last.every((m) => m.winnerId)) return state.tournament.knockout;
  if (last.length === 1) return state.tournament.knockout; // final is done
  const winners = last.map((m) => m.winnerId);
  const next = [];
  for (let i = 0; i < winners.length; i += 2) {
    next.push({
      id: makeId("m"),
      teamAId: winners[i],
      teamBId: winners[i + 1],
      winnerId: null,
      phase: "knockout",
    });
  }
  return { ...state.tournament.knockout, rounds: [...rounds, next] };
}

function tournamentChampion(state) {
  const rounds = knockoutRounds(state);
  if (!rounds.length) return null;
  const last = rounds[rounds.length - 1];
  if (last.length === 1 && last[0].winnerId) return last[0].winnerId;
  return null;
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
        s.tournament = {
          phase: "group",
          groupGames: Math.max(1, Number(action.groupGames) || 3),
          matches: [],
          knockout: null,
        };
        s.tournament = pairWaitingTeams(s);
      }
      break;
    }
    case "pairWaiting": {
      if (s.tournament && s.tournament.phase === "group") {
        s.tournament = pairWaitingTeams(s);
      }
      break;
    }
    case "startKnockout": {
      if (s.tournament && s.tournament.phase === "group" && groupStageComplete(s)) {
        s.tournament = {
          ...s.tournament,
          phase: "knockout",
          knockout: buildKnockout(s),
        };
      }
      break;
    }
    case "setMatchWinner": {
      if (s.tournament) {
        const inGroup = (s.tournament.matches || []).some((m) => m.id === action.matchId);
        if (inGroup) {
          s.tournament = {
            ...s.tournament,
            matches: s.tournament.matches.map((m) =>
              m.id === action.matchId ? { ...m, winnerId: action.winnerId } : m
            ),
          };
          if (s.tournament.phase === "group") {
            s.tournament = pairWaitingTeams(s);
          }
        } else if (s.tournament.knockout) {
          const rounds = s.tournament.knockout.rounds.map((r) =>
            r.map((m) => (m.id === action.matchId ? { ...m, winnerId: action.winnerId } : m))
          );
          // Correcting an earlier knockout result invalidates later rounds.
          const changedIdx = rounds.findIndex((r) =>
            r.some((m) => m.id === action.matchId)
          );
          s.tournament = {
            ...s.tournament,
            knockout: { ...s.tournament.knockout, rounds: rounds.slice(0, changedIdx + 1) },
          };
          s.tournament = { ...s.tournament, knockout: knockoutNextRound(s) };
        }
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
