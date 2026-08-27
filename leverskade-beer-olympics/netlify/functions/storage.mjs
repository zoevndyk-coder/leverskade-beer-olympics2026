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

/* -------- tournament: group rounds, then knockout --------
   Group stage runs as proper rounds, the way a Swiss tournament works:
   the whole round is drawn at once, so every team knows its opponent and
   matches can be played in parallel / in any order. Round 1 is a random
   draw; after that teams are ranked by record and paired with a similar
   opponent — winners meet winners, losers meet losers — and nobody ever
   plays the same team twice.
   After the group rounds the top teams go into a seeded single-elimination
   knockout: lose and you're out.
---------------------------------------------------------- */

function groupRounds(state) {
  return state.tournament?.rounds || [];
}

function groupMatchList(state) {
  return groupRounds(state).flat();
}

function knockoutRounds(state) {
  return state.tournament?.knockout?.rounds || [];
}

function standingsFor(state) {
  const table = {};
  for (const t of state.teams) {
    table[t.id] = { teamId: t.id, name: t.name, wins: 0, losses: 0, played: 0, byes: 0 };
  }
  for (const m of groupMatchList(state)) {
    if (m.isBye) {
      if (table[m.teamAId]) {
        table[m.teamAId].byes += 1;
        table[m.teamAId].wins += 1;
        table[m.teamAId].played += 1;
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
  return Object.values(table).sort(
    (a, b) => b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name)
  );
}

function playedPairs(state) {
  const set = new Set();
  for (const m of groupMatchList(state)) {
    if (m.isBye) continue;
    set.add([m.teamAId, m.teamBId].sort().join("|"));
  }
  return set;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Pairs an ordered list of teams so that nobody repeats an opponent.
// Works down the list taking the closest-ranked legal partner, and backs
// out of a choice if it leaves someone later with no legal partner.
function pairWithoutRepeats(order, played) {
  const result = [];

  function solve(remaining) {
    if (remaining.length === 0) return true;
    const a = remaining[0];
    for (let i = 1; i < remaining.length; i++) {
      const b = remaining[i];
      if (played.has([a, b].sort().join("|"))) continue;
      result.push([a, b]);
      const rest = remaining.filter((_, idx) => idx !== 0 && idx !== i);
      if (solve(rest)) return true;
      result.pop();
    }
    return false;
  }

  if (solve(order)) return result;

  // Everyone has already played everyone available — allow repeats rather
  // than stalling (only happens with very few teams and many rounds).
  const fallback = [];
  const pool = [...order];
  while (pool.length >= 2) fallback.push([pool.shift(), pool.shift()]);
  return fallback;
}

function buildGroupRound(state) {
  const rounds = groupRounds(state);
  const played = playedPairs(state);
  const table = standingsFor(state);

  let order =
    rounds.length === 0
      ? shuffle(state.teams).map((t) => t.id)
      : table.map((r) => r.teamId);

  const round = [];

  // Odd number of teams: one team sits out, chosen from the bottom of the
  // table among those who have sat out least.
  if (order.length % 2 === 1) {
    const byes = Object.fromEntries(table.map((r) => [r.teamId, r.byes]));
    let byeId = order[order.length - 1];
    for (let i = order.length - 1; i >= 0; i--) {
      if ((byes[order[i]] || 0) < (byes[byeId] || 0)) byeId = order[i];
    }
    order = order.filter((id) => id !== byeId);
    round.push({
      id: makeId("m"),
      teamAId: byeId,
      teamBId: null,
      winnerId: byeId,
      isBye: true,
    });
  }

  for (const [a, b] of pairWithoutRepeats(order, played)) {
    round.push({
      id: makeId("m"),
      teamAId: a,
      teamBId: b,
      winnerId: null,
      isBye: false,
    });
  }

  return round;
}

function roundComplete(round) {
  return round.every((m) => m.isBye || m.winnerId);
}

function groupStageComplete(state) {
  const target = state.tournament?.groupGames ?? 3;
  const rounds = groupRounds(state);
  return rounds.length >= target && rounds.every(roundComplete);
}

function knockoutSize(teamCount) {
  if (teamCount >= 8) return 8;
  if (teamCount >= 4) return 4;
  return 2;
}

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
    });
  }
  return { rounds: [round], size };
}

function knockoutNextRound(state) {
  const ko = state.tournament.knockout;
  const rounds = ko?.rounds || [];
  if (!rounds.length) return ko;
  const last = rounds[rounds.length - 1];
  if (!last.every((m) => m.winnerId)) return ko;
  if (last.length === 1) return ko;
  const winners = last.map((m) => m.winnerId);
  const next = [];
  for (let i = 0; i < winners.length; i += 2) {
    next.push({
      id: makeId("m"),
      teamAId: winners[i],
      teamBId: winners[i + 1],
      winnerId: null,
    });
  }
  return { ...ko, rounds: [...rounds, next] };
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
        // A team can only face each other team once, so the number of
        // rounds can never exceed (teams - 1).
        const maxRounds = Math.max(1, s.teams.length - 1);
        s.tournament = {
          phase: "group",
          groupGames: Math.min(maxRounds, Math.max(1, Number(action.groupGames) || 3)),
          rounds: [],
          knockout: null,
        };
        s.tournament = { ...s.tournament, rounds: [buildGroupRound(s)] };
      }
      break;
    }
    case "nextGroupRound": {
      if (s.tournament && s.tournament.phase === "group") {
        const rounds = groupRounds(s);
        if (
          rounds.length &&
          roundComplete(rounds[rounds.length - 1]) &&
          rounds.length < (s.tournament.groupGames ?? 3)
        ) {
          s.tournament = { ...s.tournament, rounds: [...rounds, buildGroupRound(s)] };
        }
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
        const inGroup = groupMatchList(s).some((m) => m.id === action.matchId);
        if (inGroup) {
          const rounds = groupRounds(s).map((r) =>
            r.map((m) =>
              m.id === action.matchId ? { ...m, winnerId: action.winnerId } : m
            )
          );
          // Correcting an earlier result changes the standings the later
          // rounds were drawn from, so those rounds are redrawn.
          const changedIdx = rounds.findIndex((r) =>
            r.some((m) => m.id === action.matchId)
          );
          s.tournament = { ...s.tournament, rounds: rounds.slice(0, changedIdx + 1) };

          // Auto-draw the next round the moment this one is finished.
          const rs = groupRounds(s);
          if (
            roundComplete(rs[rs.length - 1]) &&
            rs.length < (s.tournament.groupGames ?? 3)
          ) {
            s.tournament = { ...s.tournament, rounds: [...rs, buildGroupRound(s)] };
          }
        } else if (s.tournament.knockout) {
          const rounds = s.tournament.knockout.rounds.map((r) =>
            r.map((m) =>
              m.id === action.matchId ? { ...m, winnerId: action.winnerId } : m
            )
          );
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
