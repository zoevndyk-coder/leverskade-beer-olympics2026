import { getStore } from "@netlify/blobs";

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
    bracket: null,
    rev: 0,
  };
}

/* ---------- bracket helpers ---------- */

function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildBracket(teams) {
  const n = teams.length;
  const slots = nextPowerOfTwo(n);
  const byeCount = slots - n;
  const shuffled = shuffle(teams);
  const byeTeams = shuffled.slice(0, byeCount);
  const playTeams = shuffled.slice(byeCount);

  const byeMatches = byeTeams.map((t) => ({
    id: makeId("m"),
    teamAId: t.id,
    teamBId: null,
    winnerId: t.id,
    isBye: true,
  }));

  const playMatches = [];
  for (let i = 0; i < playTeams.length; i += 2) {
    playMatches.push({
      id: makeId("m"),
      teamAId: playTeams[i].id,
      teamBId: playTeams[i + 1] ? playTeams[i + 1].id : null,
      winnerId: null,
      isBye: false,
    });
  }

  const round0 = shuffle([...byeMatches, ...playMatches]);
  const rounds = [round0];
  let count = round0.length;
  while (count > 1) {
    count = count / 2;
    rounds.push(
      Array.from({ length: count }, () => ({ id: makeId("m"), winnerId: null }))
    );
  }
  return { rounds };
}

function applyMatchWinner(bracket, roundIdx, matchIdx, winnerId) {
  const rounds = bracket.rounds.map((r) => r.map((m) => ({ ...m })));
  rounds[roundIdx][matchIdx].winnerId = winnerId;
  let r = roundIdx;
  let i = matchIdx;
  while (r + 1 < rounds.length) {
    const nextI = Math.floor(i / 2);
    if (rounds[r + 1][nextI].winnerId !== null) {
      rounds[r + 1][nextI].winnerId = null;
    }
    r += 1;
    i = nextI;
  }
  return { ...bracket, rounds };
}

/* ---------- action reducer ---------- */

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
    case "generateBracket": {
      if (s.teams.length >= 2) s.bracket = buildBracket(s.teams);
      break;
    }
    case "resetBracket": {
      s.bracket = null;
      break;
    }
    case "setMatchWinner": {
      if (s.bracket) {
        s.bracket = applyMatchWinner(
          s.bracket,
          action.roundIdx,
          action.matchIdx,
          action.winnerId
        );
      }
      break;
    }
    default:
      break;
  }

  s.rev = (state.rev || 0) + 1;
  return s;
}

/* ---------- handler (Netlify Functions v2) ---------- */

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
    const store = getStore("beer-olympics");

    const readState = async () => {
      const raw = await store.get(KEY);
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

      // Changes arrive as small actions and get applied on top of whatever is
      // currently stored, so two people tapping at the same moment can't
      // overwrite each other's changes.
      const actions = body.actions || (body.action ? [body.action] : []);
      if (!actions.length) {
        return json({ error: "No action provided" }, 400);
      }

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

// Note: only declare the custom alias here. The default address
// (/.netlify/functions/storage) is reserved by Netlify and always works
// on its own — declaring it explicitly makes the deploy fail.
export const config = {
  path: "/api/storage",
};
