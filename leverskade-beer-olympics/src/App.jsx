import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Trophy,
  Users,
  ClipboardList,
  Award,
  Plus,
  X,
  Check,
  Mountain,
  Beer,
  Target,
  UserPlus,
  Crown,
  Loader2,
  BookOpen,
  Medal,
} from "lucide-react";

const STORAGE_KEY = "leverskade-beer-olympics-v1";

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

const DEFAULT_PARTICIPANTS = [
  "Yoyo", "Brett", "Mete", "Djibril", "Ram", "Lyla", "Milan", "Tonia",
  "Gabriel", "Carlos", "De Juan", "Tony", "Mayan", "Freya", "Christ",
  "Tayfun", "John", "Chin", "Abhi", "Mio", "Reyna", "Miguel", "Vlad",
  "Beth", "New", "Dia", "Okieve",
].map((name, i) => ({
  id: `p${i}`,
  name,
  note: name === "Milan" ? "Arrives day 2" : "",
}));

function makeId(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function groupRounds(state) {
  return state.tournament?.rounds || [];
}

function knockoutRounds(state) {
  return state.tournament?.knockout?.rounds || [];
}

function standingsFor(state) {
  const row = {};
  for (const t of state.teams) {
    row[t.id] = { teamId: t.id, name: t.name, wins: 0, losses: 0, played: 0, byes: 0 };
  }
  for (const m of groupRounds(state).flat()) {
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

function groupStageComplete(state) {
  const rounds = groupRounds(state);
  const target = state.tournament?.groupRounds ?? 3;
  return rounds.length >= target && rounds.every(roundComplete);
}

function tournamentChampion(state) {
  const rounds = knockoutRounds(state);
  if (!rounds.length) return null;
  const last = rounds[rounds.length - 1];
  return last.length === 1 && last[0].winnerId ? last[0].winnerId : null;
}

function knockoutLabel(roundIdx, size) {
  const remaining = size / Math.pow(2, roundIdx);
  if (remaining === 2) return "Final";
  if (remaining === 4) return "Semifinals";
  if (remaining === 8) return "Quarterfinals";
  return `Knockout round ${roundIdx + 1}`;
}

function defaultState() {
  return {
    participants: DEFAULT_PARTICIPANTS,
    games: DEFAULT_GAMES,
    scores: {}, // { participantId: { gameName: count } }
    teams: [], // { id, name, playerNames: [] }
    tournament: null, // { matches: [...] }
  };
}

// Netlify serves the function at /.netlify/functions/storage. The /api/storage
// path is just a friendlier alias via netlify.toml; if that alias isn't active
// we fall back to the direct path so the app still works.
const API_PATHS = ["/api/storage", "/.netlify/functions/storage"];
let apiPath = API_PATHS[0];

async function apiFetch(options) {
  let lastErr;
  for (const path of API_PATHS) {
    try {
      const res = await fetch(path, options);
      if (res.status === 404) {
        lastErr = new Error(`404 at ${path}`);
        continue;
      }
      apiPath = path;
      return res;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Could not reach the server");
}

async function fetchState() {
  const res = await apiFetch({ cache: "no-store" });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Server returned ${res.status}. ${text.slice(0, 300)}`);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(
      `Expected data but got something else (is the database function deployed?). First part of reply: ${text.slice(0, 200)}`
    );
  }
  return { ...defaultState(), ...data };
}

// Sends one small change to the server, which applies it on top of the
// current stored data and returns the updated result. Two people acting at
// the same time can't overwrite each other this way.
async function sendAction(action) {
  const res = await apiFetch({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Save failed (${res.status}): ${text.slice(0, 200)}`);
  return { ...defaultState(), ...JSON.parse(text) };
}

function totalPoints(state, participantId) {
  const s = state.scores[participantId];
  if (!s) return 0;
  return Object.values(s).reduce((a, b) => a + b, 0);
}

function bestSprinter(state) {
  let best = null;
  for (const p of state.participants) {
    const s = state.scores[p.id];
    if (!s) continue;
    for (const [game, count] of Object.entries(s)) {
      if (game === "Trick Shots") continue;
      if (count > 0 && (!best || count > best.count)) {
        best = { participant: p, game, count };
      }
    }
  }
  return best;
}

function trickShotChampion(state) {
  let best = null;
  for (const p of state.participants) {
    const count = state.scores[p.id]?.["Trick Shots"] || 0;
    if (count > 0 && (!best || count > best.count)) {
      best = { participant: p, count };
    }
  }
  return best;
}

function rankedOverall(state) {
  return state.participants
    .map((p) => ({ participant: p, points: totalPoints(state, p.id) }))
    .sort((a, b) => b.points - a.points);
}

const medalStyles = [
  { bg: "#FFD874", ring: "#B8860B", label: "1st" },
  { bg: "#E3E7EC", ring: "#8A94A3", label: "2nd" },
  { bg: "#E7B57F", ring: "#9C6A34", label: "3rd" },
];

export default function BeerOlympicsTracker() {
  const [state, setState] = useState(null);
  const [tab, setTab] = useState("leaderboard");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const pollRef = useRef(null);
  const inFlightRef = useRef(0);

  const refresh = useCallback(async (silent) => {
    // While one of our own changes is being saved, skip the poll — the
    // save response is newer than anything a refetch would return.
    if (silent && inFlightRef.current > 0) return;
    try {
      const loaded = await fetchState();
      setState(loaded);
      setOffline(false);
      setLoadError(null);
    } catch (e) {
      setOffline(true);
      if (!silent) setLoadError(e.message || String(e));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh(false);
    pollRef.current = setInterval(() => refresh(true), 4000);
    return () => clearInterval(pollRef.current);
  }, [refresh]);

  // Applies the change locally right away so the tap feels instant, then
  // confirms with the server and adopts the authoritative result.
  const dispatch = useCallback((action, optimistic) => {
    if (optimistic) setState((prev) => (prev ? optimistic(prev) : prev));
    inFlightRef.current += 1;
    setSyncing(true);
    sendAction(action)
      .then((serverState) => {
        setState(serverState);
        setOffline(false);
      })
      .catch(() => {
        setOffline(true);
        refresh(true);
      })
      .finally(() => {
        inFlightRef.current = Math.max(0, inFlightRef.current - 1);
        if (inFlightRef.current === 0) setSyncing(false);
      });
  }, [refresh]);

  if (!loading && !state && loadError) {
    return (
      <div style={{ background: BRAND.cream }} className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl p-5 border" style={{ borderColor: BRAND.mint }}>
          <div style={{ fontFamily: "'Baloo 2', sans-serif", color: BRAND.greenDark }} className="text-[16px] font-bold mb-2">
            Can't reach the scoreboard
          </div>
          <p className="text-[13px] text-[#4a4740] mb-3">
            The app loaded, but couldn't reach its database.
          </p>
          <pre className="text-[11px] bg-[#f3f5f1] rounded-lg p-3 whitespace-pre-wrap break-words text-[#4a4740] mb-3">
            {loadError}
          </pre>
          <button
            onClick={() => { setLoading(true); refresh(false); }}
            style={{ background: BRAND.green }}
            className="w-full rounded-lg py-2 text-[13px] font-bold text-white"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (loading || !state) {
    return (
      <div style={{ background: BRAND.cream }} className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[#0B5C2A]">
          <Loader2 className="animate-spin" size={28} />
          <span style={{ fontFamily: "'Baloo 2', sans-serif" }} className="text-sm font-bold tracking-wide">
            Loading the scoreboard…
          </span>
        </div>
      </div>
    );
  }

  return (
    <Shell tab={tab} setTab={setTab} syncing={syncing} offline={offline}>
      {tab === "leaderboard" && <Leaderboard state={state} />}
      {tab === "log" && <LogWin state={state} dispatch={dispatch} />}
      {tab === "beerpong" && <BeerPong state={state} dispatch={dispatch} />}
      {tab === "roster" && <Roster state={state} dispatch={dispatch} />}
      {tab === "info" && <Info state={state} />}
    </Shell>
  );
}

const BRAND = {
  cream: "#FBF8EF",
  green: "#0F7A38",
  greenDark: "#0B5C2A",
  mint: "#D7EEDA",
  orange: "#FFA933",
  orangeDark: "#DE8A17",
  ink: "#233020",
};

function Shell({ tab, setTab, syncing, offline, children }) {
  const tabs = [
    { id: "leaderboard", label: "Board", icon: Trophy },
    { id: "log", label: "Log Win", icon: Target },
    { id: "beerpong", label: "Pong", icon: Beer },
    { id: "roster", label: "Roster", icon: Users },
    { id: "info", label: "Rules", icon: BookOpen },
  ];
  return (
    <div style={{ background: BRAND.cream, fontFamily: "'Space Grotesk', sans-serif" }} className="min-h-screen text-[#233020] pb-24">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap');
      `}</style>

      <header
        style={{ background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.greenDark})` }}
        className="px-5 pt-6 pb-5 rounded-b-3xl shadow-sm relative overflow-hidden"
      >
        <Mountain
          size={140}
          strokeWidth={1}
          className="absolute -right-6 -bottom-8 text-white opacity-10"
        />
        <div className="flex items-center gap-2 relative">
          <span
            style={{ fontFamily: "'Baloo 2', sans-serif" }}
            className="text-[11px] uppercase tracking-[2px] text-white/80 font-bold"
          >
            Leverskade 2026
          </span>
          {offline ? (
            <span className="ml-auto text-[10px] text-white flex items-center gap-1 bg-red-600/80 px-2 py-0.5 rounded-full">
              offline — retrying
            </span>
          ) : syncing ? (
            <span className="ml-auto text-[10px] text-white/70 flex items-center gap-1">
              <Loader2 size={11} className="animate-spin" /> saving
            </span>
          ) : null}
        </div>
        <h1
          style={{ fontFamily: "'Baloo 2', sans-serif" }}
          className="text-white text-2xl font-extrabold tracking-tight mt-0.5 relative"
        >
          🍺 Beer Olympics Tracker
        </h1>
        <p className="text-white/85 text-[13px] mt-1 relative">
          Tap a name to log a win. Everyone's phone stays in sync.
        </p>
      </header>

      <main className="px-4 pt-5 max-w-md mx-auto">{children}</main>

      <nav
        style={{ borderTop: `1px solid ${BRAND.mint}` }}
        className="fixed bottom-0 left-0 right-0 bg-white flex justify-around items-stretch shadow-[0_-2px_10px_rgba(15,122,56,0.08)]"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 min-w-0 flex flex-col items-center gap-1 py-2.5 px-0.5"
              style={{ color: active ? BRAND.green : "#9aa39a" }}
            >
              <Icon size={19} strokeWidth={active ? 2.4 : 2} />
              <span
                style={{ fontFamily: "'Baloo 2', sans-serif" }}
                className="text-[9.5px] font-bold tracking-tight whitespace-nowrap"
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function SectionTitle({ children, icon: Icon }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {Icon && <Icon size={17} style={{ color: BRAND.green }} />}
      <h2
        style={{ fontFamily: "'Baloo 2', sans-serif", color: BRAND.greenDark }}
        className="text-[15px] font-bold tracking-wide"
      >
        {children}
      </h2>
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div
      style={{ border: `1.5px solid ${BRAND.mint}`, ...style }}
      className="bg-white rounded-2xl p-4 shadow-[0_2px_10px_rgba(15,122,56,0.06)]"
    >
      {children}
    </div>
  );
}

function Leaderboard({ state }) {
  const ranked = rankedOverall(state);
  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3).filter((r) => r.points > 0);
  const zeroes = ranked.filter((r) => r.points === 0);
  const sprinter = bestSprinter(state);
  const trickChamp = trickShotChampion(state);
  const podiumOrder = [top3[1], top3[0], top3[2]]; // 2nd, 1st, 3rd visual order
  const champId = tournamentChampion(state);

  return (
    <div className="space-y-5">
      <div>
        <SectionTitle icon={Trophy}>Overall Champion</SectionTitle>
        <Card>
          {top3.length === 0 || ranked[0].points === 0 ? (
            <EmptyHint text="No wins logged yet — head to Log Win to get started." />
          ) : (
            <div className="flex items-end justify-center gap-3 pt-1 pb-1">
              {podiumOrder.map((r, idx) => {
                if (!r || r.points === 0) return <div key={idx} className="w-16" />;
                const rank = idx === 1 ? 0 : idx === 0 ? 1 : 2;
                const style = medalStyles[rank];
                const height = rank === 0 ? 96 : rank === 1 ? 74 : 60;
                return (
                  <div key={r.participant.id} className="flex flex-col items-center w-20">
                    <div
                      style={{
                        background: style.bg,
                        border: `2px solid ${style.ring}`,
                      }}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold mb-1.5"
                    >
                      {style.label}
                    </div>
                    <div
                      style={{ fontFamily: "'Baloo 2', sans-serif" }}
                      className="text-[12.5px] font-bold text-center leading-tight truncate w-full"
                    >
                      {r.participant.name}
                    </div>
                    <div
                      style={{
                        height,
                        background: `linear-gradient(180deg, ${style.bg}, ${BRAND.cream})`,
                        border: `1.5px solid ${style.ring}55`,
                      }}
                      className="w-full rounded-t-lg mt-1.5 flex items-start justify-center pt-1.5"
                    >
                      <span className="text-[13px] font-extrabold" style={{ color: BRAND.greenDark }}>
                        {r.points}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCallout
          icon={Target}
          label="Best Sprinter"
          sub="Top score, 1 category"
          name={sprinter?.participant.name}
          detail={sprinter ? `${sprinter.count} in ${sprinter.game}` : null}
          color={BRAND.orange}
          colorDark={BRAND.orangeDark}
        />
        <StatCallout
          icon={Award}
          label="Trick Shot Champ"
          sub="Most trick shot wins"
          name={trickChamp?.participant.name}
          detail={trickChamp ? `${trickChamp.count} wins` : null}
          color={BRAND.green}
          colorDark={BRAND.greenDark}
        />
      </div>

      {champId && (
        <Card style={{ background: `linear-gradient(135deg, ${BRAND.orange}22, ${BRAND.mint}55)` }}>
          <div className="flex items-center gap-2">
            <Crown size={18} style={{ color: BRAND.orangeDark }} />
            <div>
              <div style={{ fontFamily: "'Baloo 2', sans-serif", color: BRAND.orangeDark }} className="text-[13px] font-bold">
                Beer Pong Champions
              </div>
              <div className="text-[13px] font-semibold">
                {state.teams.find((t) => t.id === champId)?.name || "—"}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div>
        <SectionTitle icon={ClipboardList}>Full Standings</SectionTitle>
        <Card>
          {ranked.every((r) => r.points === 0) ? (
            <EmptyHint text="Everyone's tied at zero — the games haven't started." />
          ) : (
            <ul className="divide-y" style={{ borderColor: BRAND.mint }}>
              {[...rest, ...(rest.length ? zeroes : [])].map((r, i) => (
                <li key={r.participant.id} className="flex items-center justify-between py-2 text-[13.5px]">
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] text-[#9aa39a] w-5">{i + 4}</span>
                    <span className="font-medium">{r.participant.name}</span>
                  </span>
                  <span
                    style={{ color: r.points > 0 ? BRAND.greenDark : "#b7bdb4" }}
                    className="font-bold"
                  >
                    {r.points} pt{r.points === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatCallout({ icon: Icon, label, sub, name, detail, color, colorDark }) {
  return (
    <Card>
      <Icon size={16} style={{ color: colorDark }} />
      <div style={{ fontFamily: "'Baloo 2', sans-serif", color: colorDark }} className="text-[12px] font-bold mt-1.5">
        {label}
      </div>
      <div className="text-[10.5px] text-[#8a9186] mb-2 leading-tight">{sub}</div>
      {name ? (
        <>
          <div className="text-[14px] font-bold leading-tight">{name}</div>
          <div className="text-[11px] text-[#8a9186]">{detail}</div>
        </>
      ) : (
        <div className="text-[12px] text-[#b7bdb4] italic">Not yet decided</div>
      )}
    </Card>
  );
}

function EmptyHint({ text }) {
  return <p className="text-[13px] text-[#8a9186] text-center py-3">{text}</p>;
}

function LogWin({ state, dispatch }) {
  const [game, setGame] = useState(state.games[0]);

  const adjust = (participantId, delta) => {
    dispatch(
      { type: "adjustScore", participantId, game, delta },
      (prev) => {
        const scores = { ...prev.scores };
        const pScores = { ...(scores[participantId] || {}) };
        pScores[game] = Math.max(0, (pScores[game] || 0) + delta);
        scores[participantId] = pScores;
        return { ...prev, scores };
      }
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <SectionTitle icon={Target}>Pick a Game</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {state.games.map((g) => (
            <button
              key={g}
              onClick={() => setGame(g)}
              style={{
                background: game === g ? BRAND.green : "#fff",
                color: game === g ? "#fff" : BRAND.greenDark,
                border: `1.5px solid ${game === g ? BRAND.green : BRAND.mint}`,
              }}
              className="px-3 py-1.5 rounded-full text-[12.5px] font-semibold"
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle icon={Check}>{game} — Wins</SectionTitle>
        <p className="text-[11.5px] text-[#8a9186] -mt-2 mb-3">
          Tap + when someone wins a round. Tap − if you tapped by mistake.
        </p>
        <div className="space-y-2">
          {state.participants.map((p) => {
            const count = state.scores[p.id]?.[game] || 0;
            return (
              <div
                key={p.id}
                style={{ border: `1.5px solid ${count > 0 ? BRAND.green : BRAND.mint}` }}
                className="bg-white rounded-xl px-3 py-2 flex items-center justify-between"
              >
                <span className="text-[13.5px] font-semibold truncate flex-1">{p.name}</span>
                <div className="flex items-center gap-2.5 flex-none">
                  <button
                    onClick={() => adjust(p.id, -1)}
                    disabled={count === 0}
                    style={{
                      background: count === 0 ? "#f1f3ef" : BRAND.mint,
                      color: count === 0 ? "#c2c8bd" : BRAND.greenDark,
                    }}
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg active:scale-90 transition-transform"
                  >
                    −
                  </button>
                  <span
                    style={{
                      fontFamily: "'Baloo 2', sans-serif",
                      color: count > 0 ? BRAND.greenDark : "#c2c8bd",
                    }}
                    className="w-6 text-center text-[16px] font-extrabold tabular-nums"
                  >
                    {count}
                  </span>
                  <button
                    onClick={() => adjust(p.id, 1)}
                    style={{ background: BRAND.green, color: "#fff" }}
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg active:scale-90 transition-transform"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BeerPong({ state, dispatch }) {
  const [teamName, setTeamName] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [p3, setP3] = useState("");
  const [wantRounds, setWantRounds] = useState(3);
  const [showHistory, setShowHistory] = useState(false);

  const tourn = state.tournament;
  const started = !!tourn;
  const phase = tourn?.phase;
  const target = tourn?.groupRounds ?? 3;

  const rounds = groupRounds(state);
  const table = standingsFor(state);
  const champion = tournamentChampion(state);
  const koRounds = knockoutRounds(state);
  const koSize = tourn?.knockout?.size ?? 0;

  const currentIdx = rounds.length - 1;
  const currentRound = rounds[currentIdx];
  const groupDone = groupStageComplete(state);
  const maxRounds = Math.max(1, state.teams.length - 1);

  const nameOf = (id) =>
    id ? state.teams.find((t) => t.id === id)?.name || "—" : "TBD";

  // Anyone already on a team, so they can't be picked twice.
  const takenNames = new Set(state.teams.flatMap((t) => t.playerNames));
  const unassigned = state.participants.filter((p) => !takenNames.has(p.name));

  const addTeam = () => {
    if (!p1) return;
    const players = [...new Set([p1, p2, p3].filter(Boolean))];
    dispatch({
      type: "addTeam",
      name: teamName.trim() || players.join(" & "),
      playerNames: players,
    });
    setTeamName(""); setP1(""); setP2(""); setP3("");
  };

  // Players still free to pick, excluding the ones chosen in the other slots.
  const optionsFor = (current, ...others) =>
    state.participants.filter(
      (p) =>
        p.name === current ||
        (!takenNames.has(p.name) && !others.includes(p.name))
    );

  const Match = ({ m, dim }) => {
    if (m.isBye) {
      return (
        <Card style={{ background: "#f7f9f5" }}>
          <div className="text-[12.5px] text-[#8a9186]">
            🎟️ <span className="font-semibold" style={{ color: BRAND.greenDark }}>{nameOf(m.teamAId)}</span> sits out this round — counts as a win
          </div>
        </Card>
      );
    }
    const decided = !!m.winnerId;
    return (
      <Card style={dim ? { opacity: 0.75 } : undefined}>
        {!decided && (
          <div className="text-[10.5px] font-bold tracking-wide mb-1.5" style={{ color: "#a9b0a3" }}>
            TAP THE WINNER
          </div>
        )}
        <div className="space-y-1.5">
          {[m.teamAId, m.teamBId].map((id) => {
            const won = decided && id === m.winnerId;
            const lost = decided && id !== m.winnerId;
            return (
              <button
                key={id}
                onClick={() => dispatch({ type: "setMatchWinner", matchId: m.id, winnerId: id })}
                style={{
                  background: won ? BRAND.mint : "#fff",
                  border: `1.5px solid ${won ? BRAND.green : BRAND.mint}`,
                  opacity: lost ? 0.5 : 1,
                }}
                className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left active:scale-[0.99] transition-transform"
              >
                <span
                  style={{ textDecoration: lost ? "line-through" : "none" }}
                  className="text-[13.5px] font-semibold"
                >
                  {nameOf(id)}
                </span>
                {won && <Check size={16} style={{ color: BRAND.greenDark }} />}
              </button>
            );
          })}
        </div>
      </Card>
    );
  };

  /* ---------- setup ---------- */
  if (!started) {
    return (
      <div className="space-y-5">
        <Card style={{ background: `${BRAND.orange}14` }}>
          <p className="text-[12.5px] leading-snug" style={{ color: BRAND.orangeDark }}>
            🍺 Teams are normally 2 people. If the numbers don't divide evenly,
            make a team of 3 — just fill in the third slot. Then pick how many
            group rounds to play.
          </p>
        </Card>

        {unassigned.length > 0 && (
          <Card style={{ background: "#f7f9f5" }}>
            <div className="text-[12.5px]" style={{ color: BRAND.greenDark }}>
              <span className="font-semibold">Not on a team yet ({unassigned.length}):</span>{" "}
              {unassigned.map((p) => p.name).join(", ")}
            </div>
            {unassigned.length % 2 === 1 && (
              <div className="text-[11.5px] mt-1.5" style={{ color: BRAND.orangeDark }}>
                That's an odd number — make one team of 3 to even it out.
              </div>
            )}
          </Card>
        )}

        <div>
          <SectionTitle icon={UserPlus}>Add a Team</SectionTitle>
          <Card>
            <div className="space-y-2">
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Team name (optional)"
                style={{ border: `1.5px solid ${BRAND.mint}` }}
                className="w-full rounded-lg px-3 py-2 text-[13.5px] outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <select value={p1} onChange={(e) => setP1(e.target.value)}
                  style={{ border: `1.5px solid ${BRAND.mint}` }}
                  className="rounded-lg px-2 py-2 text-[13px] bg-white">
                  <option value="">Player 1</option>
                  {optionsFor(p1, p2, p3).map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
                <select value={p2} onChange={(e) => setP2(e.target.value)}
                  style={{ border: `1.5px solid ${BRAND.mint}` }}
                  className="rounded-lg px-2 py-2 text-[13px] bg-white">
                  <option value="">Player 2</option>
                  {optionsFor(p2, p1, p3).map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <select value={p3} onChange={(e) => setP3(e.target.value)}
                style={{ border: `1.5px solid ${BRAND.mint}` }}
                className="w-full rounded-lg px-2 py-2 text-[13px] bg-white">
                <option value="">Player 3 — optional, for a team of three</option>
                {optionsFor(p3, p1, p2).map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
              <button onClick={addTeam} disabled={!p1}
                style={{ background: p1 ? BRAND.orange : "#eee", color: p1 ? "#fff" : "#aaa" }}
                className="w-full rounded-lg py-2 text-[13px] font-bold flex items-center justify-center gap-1.5">
                <Plus size={15} /> Add Team
              </button>
            </div>
          </Card>
        </div>

        {state.teams.length > 0 && (
          <div>
            <SectionTitle icon={Users}>Teams ({state.teams.length})</SectionTitle>
            <div className="space-y-2">
              {state.teams.map((t) => (
                <Card key={t.id}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div style={{ fontFamily: "'Baloo 2', sans-serif" }} className="text-[13.5px] font-bold truncate">{t.name}</div>
                      <div className="text-[11.5px] text-[#8a9186] truncate">
                        {t.playerNames.join(" & ")}
                        {t.playerNames.length === 3 && (
                          <span style={{ background: BRAND.orange + "33", color: BRAND.orangeDark }}
                            className="ml-1.5 text-[9.5px] font-bold rounded-full px-1.5 py-0.5">
                            TRIO
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => dispatch({ type: "removeTeam", id: t.id })} className="flex-none ml-2">
                      <X size={15} className="text-[#c2c8bd]" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {state.teams.length >= 2 && (
          <>
            <Card>
              <div className="text-[12.5px] font-semibold mb-2" style={{ color: BRAND.greenDark }}>
                Group rounds
              </div>
              <div className="flex gap-2">
                {[2, 3, 4].map((n) => {
                  const ok = n <= maxRounds;
                  const on = wantRounds === n && ok;
                  return (
                    <button key={n} onClick={() => ok && setWantRounds(n)} disabled={!ok}
                      style={{
                        background: on ? BRAND.green : "#fff",
                        color: !ok ? "#c9cec6" : on ? "#fff" : BRAND.greenDark,
                        border: `1.5px solid ${on ? BRAND.green : BRAND.mint}`,
                      }}
                      className="flex-1 rounded-lg py-2 text-[13px] font-bold">
                      {n}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11.5px] text-[#8a9186] mt-2 mb-0">
                {state.teams.length} teams ·{" "}
                {Math.min(wantRounds, maxRounds) * Math.floor(state.teams.length / 2)} group matches ·
                top {state.teams.length >= 8 ? 8 : state.teams.length >= 4 ? 4 : 2} go through
                {maxRounds < 4 && ` · max ${maxRounds} rounds without repeats`}
              </p>
            </Card>

            <button
              onClick={() => dispatch({ type: "startTournament", groupRounds: wantRounds })}
              style={{ background: BRAND.orange }}
              className="w-full rounded-xl py-3 text-[14px] font-bold text-white flex items-center justify-center gap-2">
              <Trophy size={17} /> Start Tournament
            </button>
          </>
        )}
      </div>
    );
  }

  /* ---------- running ---------- */
  const qualified = new Set(koRounds[0]?.flatMap((m) => [m.teamAId, m.teamBId]) || []);
  const koCurrentIdx = koRounds.length - 1;

  return (
    <div className="space-y-5">
      {champion ? (
        <Card style={{ background: `linear-gradient(135deg, ${BRAND.orange}30, ${BRAND.mint}70)` }}>
          <div className="flex items-center gap-2 justify-center py-2">
            <Crown size={22} style={{ color: BRAND.orangeDark }} />
            <span style={{ fontFamily: "'Baloo 2', sans-serif", color: BRAND.orangeDark }} className="text-[16px] font-extrabold">
              {nameOf(champion)} — Champions!
            </span>
          </div>
        </Card>
      ) : (
        <Card style={{ background: `${BRAND.green}0f` }}>
          <div className="text-[12.5px] font-semibold" style={{ color: BRAND.greenDark }}>
            {phase === "group"
              ? `Group stage · round ${rounds.length} of ${target}`
              : `Knockout · ${knockoutLabel(koCurrentIdx, koSize)}`}
          </div>
        </Card>
      )}

      {/* current thing to do */}
      {phase === "group" && currentRound && (
        <div>
          <SectionTitle icon={Target}>Round {currentIdx + 1}</SectionTitle>
          <div className="space-y-2">
            {currentRound.map((m) => <Match key={m.id} m={m} />)}
          </div>
        </div>
      )}

      {phase === "knockout" && koRounds.map((round, i) => (
        <div key={i}>
          <SectionTitle icon={Trophy}>{knockoutLabel(i, koSize)}</SectionTitle>
          <div className="space-y-2">
            {round.map((m) => <Match key={m.id} m={m} dim={i < koCurrentIdx} />)}
          </div>
        </div>
      ))}

      {/* progress button */}
      {phase === "group" && groupDone && (
        <button onClick={() => dispatch({ type: "startKnockout" })}
          style={{ background: BRAND.orange }}
          className="w-full rounded-xl py-3 text-[14px] font-bold text-white flex items-center justify-center gap-2">
          <Trophy size={17} /> Group stage done — start knockout
        </button>
      )}
      {phase === "group" && !groupDone && roundComplete(currentRound) && rounds.length < target && (
        <button onClick={() => dispatch({ type: "drawNextRound" })}
          style={{ background: BRAND.green }}
          className="w-full rounded-xl py-3 text-[14px] font-bold text-white flex items-center justify-center gap-2">
          <Plus size={17} /> Draw round {rounds.length + 1}
        </button>
      )}

      {/* standings */}
      <div>
        <SectionTitle icon={ClipboardList}>Standings</SectionTitle>
        <Card>
          <ul className="divide-y" style={{ borderColor: BRAND.mint }}>
            {table.map((r, i) => {
              const through = phase === "knockout" && qualified.has(r.teamId);
              const out = phase === "knockout" && !through;
              return (
                <li key={r.teamId} className="flex items-center justify-between py-2 text-[13px]" style={{ opacity: out ? 0.4 : 1 }}>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] text-[#9aa39a] w-4 flex-none">{i + 1}</span>
                    <span className="font-semibold truncate">{r.name}</span>
                    {through && (
                      <span style={{ background: BRAND.mint, color: BRAND.greenDark }}
                        className="text-[9.5px] font-bold rounded-full px-1.5 py-0.5 flex-none">THROUGH</span>
                    )}
                  </span>
                  <span className="flex-none font-bold" style={{ color: BRAND.greenDark }}>
                    {r.wins}W – {r.losses}L
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* earlier rounds, tucked away */}
      {rounds.length > 1 && (
        <div>
          <button onClick={() => setShowHistory(!showHistory)}
            className="w-full text-[12.5px] font-semibold py-2 rounded-lg"
            style={{ color: BRAND.greenDark, background: "#f3f5f1" }}>
            {showHistory ? "Hide" : "Show"} earlier rounds ({rounds.length - 1})
          </button>
          {showHistory && (
            <div className="space-y-4 mt-3">
              {rounds.slice(0, phase === "group" ? -1 : undefined).map((round, i) => (
                <div key={i}>
                  <SectionTitle icon={Check}>Round {i + 1}</SectionTitle>
                  <div className="space-y-2">
                    {round.map((m) => <Match key={m.id} m={m} dim />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => {
          if (window.confirm("Reset the tournament? All results are cleared.")) {
            dispatch({ type: "resetTournament" }, (prev) => ({ ...prev, tournament: null }));
          }
        }}
        className="w-full text-[12px] font-semibold py-2" style={{ color: "#b7bdb4" }}>
        Reset tournament
      </button>
    </div>
  );
}

function Roster({ state, dispatch }) {
  const [name, setName] = useState("");

  const addPerson = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    dispatch({ type: "addParticipant", name: trimmed });
    setName("");
  };

  const removePerson = (id) => {
    dispatch({ type: "removeParticipant", id }, (prev) => ({
      ...prev,
      participants: prev.participants.filter((p) => p.id !== id),
    }));
  };

  return (
    <div className="space-y-4">
      <Card style={{ background: `${BRAND.green}0f` }}>
        <p className="text-[12.5px] leading-snug" style={{ color: BRAND.greenDark }}>
          {state.participants.length} people on the roster. Add anyone missing, or remove duplicates.
        </p>
      </Card>

      <Card>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addPerson()}
            placeholder="Add a name…"
            style={{ border: `1.5px solid ${BRAND.mint}` }}
            className="flex-1 rounded-lg px-3 py-2 text-[13.5px] outline-none"
          />
          <button
            onClick={addPerson}
            style={{ background: BRAND.green }}
            className="rounded-lg px-3 text-white"
          >
            <Plus size={16} />
          </button>
        </div>
      </Card>

      <ul className="space-y-1.5">
        {state.participants.map((p) => (
          <li key={p.id}>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[13.5px] font-medium">{p.name}</span>
                  {p.note && (
                    <span
                      style={{ background: BRAND.orange + "22", color: BRAND.orangeDark }}
                      className="ml-2 text-[10.5px] font-semibold rounded-full px-2 py-0.5"
                    >
                      {p.note}
                    </span>
                  )}
                </div>
                <button onClick={() => removePerson(p.id)}>
                  <X size={15} className="text-[#c2c8bd]" />
                </button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Info({ state }) {
  const target = state.tournament?.groupRounds ?? 3;
  const teamCount = state.teams.length;
  const koSize = teamCount >= 8 ? 8 : teamCount >= 4 ? 4 : 2;

  const InfoCard = ({ icon: Icon, title, accent, children }) => (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon size={17} style={{ color: accent || BRAND.green }} />}
        <h2
          style={{ fontFamily: "'Baloo 2', sans-serif", color: accent || BRAND.greenDark }}
          className="text-[15px] font-bold tracking-wide"
        >
          {title}
        </h2>
      </div>
      <Card>{children}</Card>
    </div>
  );

  const Rule = ({ children }) => (
    <li className="flex gap-2.5 text-[13px] leading-relaxed mb-2 last:mb-0">
      <span style={{ color: BRAND.green }} className="flex-none font-bold">
        •
      </span>
      <span>{children}</span>
    </li>
  );

  return (
    <div className="space-y-5">
      <Card
        style={{
          background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.greenDark})`,
          border: "none",
        }}
      >
        <div className="text-center py-1">
          <div
            style={{ fontFamily: "'Baloo 2', sans-serif" }}
            className="text-white text-[19px] font-extrabold"
          >
            🍺 Beer Olympics
          </div>
          <div className="text-white/85 text-[12.5px] mt-1">
            Friday 4 September · from 15:30
          </div>
          <div className="text-white/85 text-[12.5px]">
            Winners announced at 21:00
          </div>
        </div>
      </Card>

      <InfoCard icon={Target} title="How Scoring Works">
        <ul className="m-0 p-0 list-none">
          <Rule>
            Every game you win is worth <b>1 point</b>. That's it — no bonus
            points, no partial scores.
          </Rule>
          <Rule>
            Play as many games as you like, as often as you like. More games
            played means more chances to score.
          </Rule>
          <Rule>
            Anyone can log a win in the <b>Log Win</b> tab — tap <b>+</b> next to
            the winner's name. Tapped by mistake? Tap <b>−</b> to undo it.
          </Rule>
          <Rule>
            Beer Pong is scored <b>separately</b> and does not count toward your
            overall points.
          </Rule>
        </ul>
      </InfoCard>

      <InfoCard icon={Beer} title="The Games">
        <div className="flex flex-wrap gap-1.5">
          {state.games.map((g) => (
            <span
              key={g}
              style={{ background: BRAND.mint, color: BRAND.greenDark }}
              className="text-[12px] font-semibold rounded-full px-2.5 py-1"
            >
              {g}
            </span>
          ))}
        </div>
        <p className="text-[12.5px] text-[#6a7166] mt-3 mb-0">
          BYOD — bring your own drink. Alcohol-free works just as well; the
          games are the point, not the beer.
        </p>
      </InfoCard>

      <InfoCard icon={Medal} title="Prizes" accent={BRAND.orangeDark}>
        <div className="space-y-3">
          <div>
            <div
              style={{ fontFamily: "'Baloo 2', sans-serif", color: BRAND.orangeDark }}
              className="text-[13.5px] font-bold"
            >
              🏆 Overall Champion
            </div>
            <div className="text-[12.5px] text-[#4a4740]">
              Most points across all games combined.
            </div>
          </div>
          <div>
            <div
              style={{ fontFamily: "'Baloo 2', sans-serif", color: BRAND.orangeDark }}
              className="text-[13.5px] font-bold"
            >
              ⚡ Best Sprinter
            </div>
            <div className="text-[12.5px] text-[#4a4740]">
              Highest score in a single game — the specialist's award.
            </div>
          </div>
          <div>
            <div
              style={{ fontFamily: "'Baloo 2', sans-serif", color: BRAND.orangeDark }}
              className="text-[13.5px] font-bold"
            >
              🎯 Trick Shot Champion
            </div>
            <div className="text-[12.5px] text-[#4a4740]">
              Most Trick Shot wins.
            </div>
          </div>
          <div>
            <div
              style={{ fontFamily: "'Baloo 2', sans-serif", color: BRAND.orangeDark }}
              className="text-[13.5px] font-bold"
            >
              🍺 Beer Pong Champions
            </div>
            <div className="text-[12.5px] text-[#4a4740]">
              The team that wins the Beer Pong tournament.
            </div>
          </div>
        </div>
      </InfoCard>

      <InfoCard icon={Beer} title="Beer Pong Format" accent={BRAND.orangeDark}>
        <ul className="m-0 p-0 list-none">
          <Rule>
            Pick your own teams — normally <b>2 people</b>, but if the numbers
            don't divide evenly you can make a <b>team of 3</b>. Add them in the
            Beer Pong tab before the tournament starts.
          </Rule>
          <Rule>
            <b>Group stage:</b> {target} rounds. The whole round is drawn at
            once, so every pairing is known upfront and matches can be played
            in any order or on several tables at the same time.
          </Rule>
          <Rule>
            Round 1 is a random draw. After that teams are ranked by record and
            paired with a similar opponent — winners face winners, losers face
            losers — and you never play the same team twice.
          </Rule>
          <Rule>
            <b>Knockout:</b> the top {koSize} teams go through, seeded so the
            best team faces the weakest qualifier. Lose and you're out — down to
            the final.
          </Rule>
          <Rule>
            Tap the winning team's name to record a result. Got it wrong? Just
            tap the other team to correct it.
          </Rule>
        </ul>
      </InfoCard>

      <InfoCard icon={Users} title="House Rules">
        <ul className="m-0 p-0 list-none">
          <Rule>Log your wins honestly — the whole thing runs on trust.</Rule>
          <Rule>
            Everyone sees the same live scoreboard. Anything you log shows up on
            everyone else's phone within a few seconds.
          </Rule>
          <Rule>
            Missing from the roster? Add yourself in the <b>Roster</b> tab.
          </Rule>
          <Rule>
            Drink water between games. Alcohol-free options are always fine.
          </Rule>
          <Rule>18+ only. Look after each other and have fun.</Rule>
        </ul>
      </InfoCard>

      <p className="text-center text-[11.5px] text-[#a9b0a3] pt-1">
        🏕 Leverskade · 3–6 September 2026
      </p>
    </div>
  );
}
