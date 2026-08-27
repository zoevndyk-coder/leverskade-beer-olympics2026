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

// Everyone's single best game (Trick Shots excluded — that has its own award).
function rankedSprint(state) {
  return state.participants
    .map((p) => {
      const s = state.scores[p.id] || {};
      let best = { game: null, count: 0 };
      for (const [game, count] of Object.entries(s)) {
        if (game === "Trick Shots") continue;
        if (count > best.count) best = { game, count };
      }
      return { participant: p, game: best.game, count: best.count };
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count || a.participant.name.localeCompare(b.participant.name));
}

function rankedTrickShots(state) {
  return state.participants
    .map((p) => ({ participant: p, count: state.scores[p.id]?.["Trick Shots"] || 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count || a.participant.name.localeCompare(b.participant.name));
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
  const [tab, setTab] = useState("info");
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
      {tab === "info" && <Info state={state} setTab={setTab} />}
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
  const sprinter = bestSprinter(state);
  const trickChamp = trickShotChampion(state);
  const podiumOrder = [top3[1], top3[0], top3[2]]; // 2nd, 1st, 3rd visual order
  const champId = tournamentChampion(state);
  const champTeam = state.teams.find((t) => t.id === champId);
  const sprintRanking = rankedSprint(state);
  const trickRanking = rankedTrickShots(state);

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
                {champTeam?.name || "—"}
              </div>
              {champTeam?.playerNames?.length > 0 && (
                <div className="text-[11.5px] text-[#5a6156] mt-0.5">
                  {champTeam.playerNames.join(" · ")}
                </div>
              )}
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
              {ranked.map((r, i) => {
                const medal = r.points > 0 && i < 3 ? medalStyles[i] : null;
                return (
                  <li
                    key={r.participant.id}
                    className="flex items-center justify-between py-2 text-[13.5px]"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {medal ? (
                        <span
                          style={{ background: medal.bg, border: `1.5px solid ${medal.ring}` }}
                          className="w-5 h-5 rounded-full flex-none flex items-center justify-center text-[10px] font-bold"
                        >
                          {i + 1}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#9aa39a] w-5 flex-none text-center">
                          {i + 1}
                        </span>
                      )}
                      <span className={medal ? "font-bold truncate" : "font-medium truncate"}>
                        {r.participant.name}
                      </span>
                    </span>
                    <span
                      style={{ color: r.points > 0 ? BRAND.greenDark : "#b7bdb4" }}
                      className="font-bold flex-none"
                    >
                      {r.points} pt{r.points === 1 ? "" : "s"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
      <div>
        <SectionTitle icon={Target}>Best Sprinter Ranking</SectionTitle>
        <p className="text-[11.5px] text-[#8a9186] -mt-2 mb-2">
          Highest score in any single game (Trick Shots excluded).
        </p>
        <MiniTable
          rows={sprintRanking}
          suffix=""
          empty="No wins logged yet."
        />
      </div>

      <div>
        <SectionTitle icon={Award}>Trick Shot Ranking</SectionTitle>
        <p className="text-[11.5px] text-[#8a9186] -mt-2 mb-2">
          Most Trick Shot wins.
        </p>
        <MiniTable
          rows={trickRanking}
          suffix=""
          empty="No trick shots logged yet."
        />
      </div>
    </div>
  );
}

function MiniTable({ rows, empty, suffix }) {
  if (!rows.length) return <Card><EmptyHint text={empty} /></Card>;
  return (
    <Card>
      <ul className="divide-y" style={{ borderColor: BRAND.mint }}>
        {rows.map((r, i) => {
          const medal = i < 3 ? medalStyles[i] : null;
          return (
            <li
              key={r.participant.id}
              className="flex items-center justify-between py-2 text-[13.5px]"
            >
              <span className="flex items-center gap-2 min-w-0">
                {medal ? (
                  <span
                    style={{ background: medal.bg, border: `1.5px solid ${medal.ring}` }}
                    className="w-5 h-5 rounded-full flex-none flex items-center justify-center text-[10px] font-bold"
                  >
                    {i + 1}
                  </span>
                ) : (
                  <span className="text-[11px] text-[#9aa39a] w-5 flex-none text-center">
                    {i + 1}
                  </span>
                )}
                <span className={medal ? "font-bold truncate" : "font-medium truncate"}>
                  {r.participant.name}
                </span>
                {r.game && (
                  <span className="text-[11px] text-[#8a9186] truncate">· {r.game}</span>
                )}
              </span>
              <span className="font-bold flex-none" style={{ color: BRAND.greenDark }}>
                {r.count}{suffix}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
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
  const championTeam = state.teams.find((t) => t.id === champion);
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
          <div className="text-center py-2">
            <div className="flex items-center gap-2 justify-center">
              <Crown size={22} style={{ color: BRAND.orangeDark }} />
              <span style={{ fontFamily: "'Baloo 2', sans-serif", color: BRAND.orangeDark }} className="text-[16px] font-extrabold">
                {nameOf(champion)} — Champions!
              </span>
            </div>
            {championTeam?.playerNames?.length > 0 && (
              <div className="text-[12.5px] font-semibold mt-1" style={{ color: BRAND.greenDark }}>
                {championTeam.playerNames.join(" · ")}
              </div>
            )}
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


// Short, practical rules for each game. Where a game has lots of regional
// variants, the common version is given — settle disputes on the night.
const GAME_RULES = {
  "Flip Cup": {
    players: "Two teams, equal numbers",
    min: "Minimum 6 players (3 v 3) · even teams",
    how: [
      "Teams line up facing each other along the table, each player with a filled cup.",
      "First player drinks their cup, sets it upright at the table edge, then flips it with a fingertip until it lands face down.",
      "Only once it lands face down may the next teammate start.",
      "First team with every cup flipped takes the round.",
      "Play three rounds — the team that wins two of them takes it.",
    ],
    finish: "Winner: the team that takes 2 of the 3 rounds. Everyone on that team logs 1 point.",
  },
  "Rage Cage": {
    players: "Everyone, standing in a circle",
    min: "Minimum 5 players · 19 cups minimum on the table",
    how: [
      "Set out at least 19 cups in a circle with one cup in the middle. Fill them with whatever you like — it's your choice what goes in.",
      "Two players opposite each other start, each with a ball and a cup.",
      "Your playing cup has to stay touching the other cups on the table while you're bouncing.",
      "Bounce your ball into your cup. Once you sink it, pass the cup to the player on your left and the ball carries on round.",
      "Knock over another cup by accident and you drink that one, add it to the cup you're playing with, and only then carry on.",
      "If you sink yours before the player to your right, stack your cup inside theirs — they now have to catch up.",
      "First person to sink the middle cup claims it; whoever is left holding the stack loses that round and drops out.",
      "Re-set and keep playing rounds, one player out each time.",
    ],
    finish: "Winner: the last player left in. That player logs 1 point — nobody else scores.",
  },
  "Flunkyball": {
    players: "Two teams, facing off",
    min: "Minimum 6 players (3 v 3) · even teams",
    how: [
      "Teams stand facing each other about 6–8 m apart, each player with a drink in front of them.",
      "One bottle (the flunky) stands in the middle.",
      "Teams take turns throwing a ball to knock over the middle bottle.",
      "The moment it falls, the throwing team starts drinking.",
      "Meanwhile the other team fetches the ball, stands the middle bottle back up, runs back behind their own line — and only then shouts STOP.",
      "Everyone stops drinking on STOP. First team to finish all their drinks wins.",
    ],
    finish: "Winner: the team that empties all their drinks first. Everyone on that team logs 1 point.",
  },
  "Cornhole": {
    players: "Two teams",
    min: "Minimum 2 players (1 v 1) · best with 4",
    how: [
      "Boards face each other 27 feet (about 8 m) apart.",
      "You must stand next to the board to throw. Each side has 4 bags.",
      "Players alternate throws until all bags are thrown.",
      "Bag completely through the hole: 3 points.",
      "Bag resting on the board: 1 point.",
      "If a bag touches the ground after it stops moving, it scores nothing.",
      "Each round only the difference between the two team totals counts.",
    ],
    finish: "Winner: the first team to 21 points. Everyone on that team logs 1 point.",
  },
  "Kubb": {
    players: "Two teams",
    min: "Minimum 2 players (1 v 1) · best with 4–6",
    how: [
      "Each team has five kubbs (wooden blocks) along their baseline and the king stands in the centre.",
      "Throw batons underarm, end over end, to knock over the opponent's kubbs.",
      "Any kubb you knock down gets thrown into the opponent's half and stood up — those must be cleared first on their next turn.",
      "Once every kubb is down, knock over the king to win.",
      "Hit the king too early and you lose the game instantly.",
    ],
    finish: "Winner: the team that fells the king. Everyone on that team logs 1 point.",
  },
  "Frisbee": {
    players: "Two teams of two",
    min: "Exactly 4 players — two teams of two",
    how: [
      "Buckets are set about 10 m apart. You stand behind one bucket next to your opponent; your teammate stands at the far bucket.",
      "The thrower must stay behind their bucket. The teammate at the other end can move wherever they like.",
      "Teammate leaves it and the frisbee hits the bucket clean: 2 points.",
      "Teammate deflects it onto the bucket: 1 point.",
      "Teammate slam dunks it into the top: 3 points.",
      "Missed completely or it hits the ground: nothing.",
      "Throw it straight through the slit and you win on the spot.",
      "Otherwise race to exactly 21 — overshoot and the extra comes back off your score.",
    ],
    finish: "Winner: the team that hits exactly 21, or throws it through the slit. Both players log 1 point.",
  },
  "Tug of War": {
    players: "Two teams",
    min: "Minimum 8 players (4 v 4) · even teams",
    how: [
      "Teams take either end of the rope with a marker tied at the centre.",
      "On the call, pull. Win the round by dragging the centre marker past your side's line.",
      "No sitting down, no wrapping the rope around hands or body.",
      "Play three rounds — the team that wins two of them takes it.",
    ],
    finish: "Winner: the team that takes 2 of the 3 pulls. Everyone on that team logs 1 point.",
  },
  Darts: {
    players: "Individual or pairs",
    min: "Minimum 2 players",
    how: [
      "Standard 501: everyone starts on 501 points.",
      "Three darts per turn; the total is subtracted from your score.",
      "You must land exactly on zero to win, finishing on a double.",
      "Bust (going below zero or landing on 1) and the turn doesn't count.",
    ],
    finish: "Winner: the first to check out on a double. That player logs 1 point (in pairs, both partners do).",
  },
  "Pétanque": {
    players: "Singles, doubles or triples",
    min: "Minimum 2 players · up to 6 in triples",
    how: [
      "Throw the small jack 6–10 m from the throwing circle.",
      "Take turns throwing boules, aiming to land closest to the jack.",
      "The team not holding the closest boule keeps throwing until they take the lead or run out.",
      "You score one point for every boule closer to the jack than the opponent's best.",
      "First to 13 wins.",
    ],
    finish: "Winner: the first team to 13. Everyone on that team logs 1 point.",
  },
  "Trick Shots": {
    players: "Individual",
    min: "1 player + someone to witness it",
    how: [
      "Attempt a creative shot into a cup — bounce, behind the back, off a chair, over the shoulder.",
      "It has to be witnessed by someone else to count.",
      "Each landed shot is one win — log it and try another.",
      "Repeating the exact same shot doesn't count twice; keep them different.",
      "Trick shots earned at the Beer Pong table count too — log them here.",
    ],
    finish: "Every different shot you land is a win — log 1 point for each one.",
  },
};


const FRISBEE_DIAGRAM = "data:image/jpeg;base64,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";

function Info({ state, setTab }) {
  const [openGame, setOpenGame] = useState(null);
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
            A win is worth <b>1 point</b>. No bonus points, no partial scores.
          </Rule>
          <Rule>
            In team games <b>everyone on the winning team gets a point</b> — not
            one point split between you. Win Tug of War as a six and all six of
            you log a point.
          </Rule>
          <Rule>
            Most games are one point for the win. Flip Cup and Tug of War are
            played <b>best of 3</b> — you score once for taking the match, not
            once per round.
          </Rule>
          <Rule>
            Play as much as you like, in any order. Tap a game above to see
            exactly when a point is scored in it.
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
        <p className="text-[12px] text-[#6a7166] mt-0 mb-2.5">
          Tap a game to see how it's played.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {state.games.map((g) => {
            const open = openGame === g;
            return (
              <button
                key={g}
                onClick={() => setOpenGame(open ? null : g)}
                style={{
                  background: open ? BRAND.green : BRAND.mint,
                  color: open ? "#fff" : BRAND.greenDark,
                }}
                className="text-[12px] font-semibold rounded-full px-2.5 py-1"
              >
                {g}
              </button>
            );
          })}
        </div>

        {openGame && GAME_RULES[openGame] && (
          <div
            style={{ background: "#f4f8f2", borderLeft: `2mm solid ${BRAND.green}` }}
            className="rounded-lg mt-3 px-3 py-2.5"
          >
            <div className="flex items-baseline justify-between gap-2">
              <div
                style={{ fontFamily: "'Baloo 2', sans-serif", color: BRAND.greenDark }}
                className="text-[14px] font-bold"
              >
                {openGame}
              </div>
              <button
                onClick={() => setOpenGame(null)}
                className="text-[11px] font-semibold flex-none"
                style={{ color: "#8a9186" }}
              >
                close
              </button>
            </div>
            <div className="text-[11.5px] text-[#6a7166] mb-0.5">
              {GAME_RULES[openGame].players}
            </div>
            {GAME_RULES[openGame].min && (
              <div className="text-[11.5px] font-semibold mb-2" style={{ color: BRAND.orangeDark }}>
                👥 {GAME_RULES[openGame].min}
              </div>
            )}

            <ol className="m-0 pl-4 text-[12.5px] leading-relaxed">
              {GAME_RULES[openGame].how.map((line, i) => (
                <li key={i} className="mb-1 last:mb-0">{line}</li>
              ))}
            </ol>
            {openGame === "Frisbee" && (
              <div className="mt-3 rounded-lg bg-white p-2">
                <img
                  src={FRISBEE_DIAGRAM}
                  alt="How the bucket game is played"
                  className="w-full h-auto rounded"
                />
                <p className="text-[11px] text-[#6a7166] mt-1.5 mb-0 text-center">
                  We play the buckets about <b>10 m</b> apart, not 50 feet.
                </p>
              </div>
            )}
            {GAME_RULES[openGame].finish && (
              <div
                style={{ background: BRAND.green, color: "#fff" }}
                className="rounded-md px-2.5 py-2 mt-2.5 text-[12px] font-semibold leading-snug"
              >
                🏆 {GAME_RULES[openGame].finish}
              </div>
            )}
          </div>
        )}

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
              Most Trick Shot wins — including ones earned at the Beer Pong
              table.
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

      <InfoCard icon={Beer} title="Beer Pong — Table Rules" accent={BRAND.orangeDark}>
        <ul className="m-0 p-0 list-none">
          <Rule>
            <b>Blowing out:</b> if the ball is spinning in the cup and hasn't
            settled into the drink yet, you can blow it back out.
          </Rule>
          <Rule>
            <b>Bounces:</b> once the ball bounces on the table it's fair game —
            slap it away.
          </Rule>
          <Rule>
            <b>Balls back:</b> if both throwers hit (or 2 of 3 in a trio), your
            team gets the balls back for another go.
          </Rule>
          <Rule>
            <b>Same cup twice:</b> both of you sink the same cup and it's worth{" "}
            <b>3 cups</b>.
          </Rule>
          <Rule>
            <b>Double airball:</b> if both of you miss so badly you don't even
            touch a cup, you remove one of your <b>own</b> cups.
          </Rule>
          <Rule>
            <b>Trick shot chance:</b> throw a ball that rolls back to your side
            and catch it before the other team — that earns you a trick shot
            attempt. Land it and it counts towards <b>Trick Shot Champion</b>,
            so log it under Trick Shots.
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

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          onClick={() => setTab("log")}
          style={{ background: BRAND.green }}
          className="rounded-xl py-3 text-[13.5px] font-bold text-white flex items-center justify-center gap-1.5"
        >
          <Target size={16} /> Log a win
        </button>
        <button
          onClick={() => setTab("leaderboard")}
          style={{ background: "#fff", color: BRAND.greenDark, border: `1.5px solid ${BRAND.mint}` }}
          className="rounded-xl py-3 text-[13.5px] font-bold flex items-center justify-center gap-1.5"
        >
          <Trophy size={16} /> Scoreboard
        </button>
      </div>

      <p className="text-center text-[11.5px] text-[#a9b0a3] pt-1">
        🏕 Leverskade · 3–6 September 2026
      </p>
    </div>
  );
}
