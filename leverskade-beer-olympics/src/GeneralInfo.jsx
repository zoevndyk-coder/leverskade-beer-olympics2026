import React from "react";
import {
  Hammer,
  Shirt,
  CalendarDays,
  Receipt,
  CreditCard,
  Thermometer,
  Package,
  Bug,
} from "lucide-react";
import { BRAND, Card, SectionTitle } from "./ui.jsx";

const BUILD_CREW =
  "Brett (Hendrik) · Milan (Tim S.) · Carlos (Pütti) · Christ (Jonas) · Chin (Marvin) · Ram (Nils) · Djibril (Steffen)";
const BREAK_CREW =
  "Brett (Hendrik) · Tonia (Mareike) · Christ (Jonas) · John (Floris) · Chin (Marvin) · Miguel (Seb)";

const SUPPLIES = [
  {
    name: "Yoyo (Zoë)",
    star: true,
    items:
      "1× Tarp · 2× Scissors · 1× Gavel · 1× Writing pad · 1× Pens/Markers · 1× Bottle opener · 1× Can opener · 1× Shovel · 1× Gas stove · 2× Wash buckets · 4× Dish towels · 1× Water tank 10L · 1× Camping shower · 1× Electricity adapter · 2× Extension cords 50m · 1× Multi outlet · 1× Electric cooler · 2× First aid kits · 1× Female hygiene products · 1× Fire extinguisher/blanket · 1× Hammock · Decoration · Pétanque set · Darts · Killing game · Codices · Shot glasses · Cups · Beerpong balls · Banner · Stickers · Prizes · Marshmallow sticks",
  },
  { name: "Gabriel (Pascal)", items: "2× Rope" },
  {
    name: "Djibril (Steffen)",
    items:
      "2× Duct tape · 3× Beer tables · 8× Beer benches · 1× Reusable beerpong cups · 5× Beerpong balls",
  },
  { name: "Mayan (Emma)", items: "1× Pavillon · 2× Water tanks 10L · 1× Electric cooler" },
  { name: "Freya (Jessica)", items: "1× Scissors · 1× Gavel · 1× Pens/Markers · 1× Gas stove" },
  {
    name: "Christ (Jonas)",
    items: "1× Pavillon · 2× Water tanks 10L · 3× String lights/Party lights",
  },
  { name: "Chin (Marvin)", items: "5× Large lamps · 1× Go Pro camera" },
  {
    name: "Vlad (Matthias)",
    items:
      "1× Pavillon · 1× Beerpong table · 1× BBQ · 1× BBQ cutlery · 1× Bottle opener · 1× Extension cord 50m · 1× Multi outlet · 1× Kubb set · 1× Cornhole · 1× Spikeball · 1× Frisbee game",
  },
  {
    name: "Mete (Leander)",
    items:
      "1× Pavillon · 1× Tarp · 2× Beer tables · 2× Beer benches · 1× Beerpong table · 1× Gas stove · 1× Large lamp · 1× Electric cooler",
  },
  { name: "Ram (Nils)", items: "1× Speaker + charger" },
];

const TONES = {
  green: { bg: "#e8f5e4", border: "#7bc67a", label: "#2d5a27" },
  orange: { bg: "#fff3e0", border: "#ffb74d", label: "#e65100" },
  red: { bg: "#fdecea", border: "#ef9a9a", label: "#c62828" },
  grey: { bg: "#f3f5f1", border: "#d5dcd2", label: "#4a4740" },
};

function Panel({ tone = "green", title, children }) {
  const t = TONES[tone];
  return (
    <div
      style={{ background: t.bg, border: `1.5px solid ${t.border}` }}
      className="rounded-xl px-3.5 py-3 mb-2.5 last:mb-0"
    >
      {title && (
        <p style={{ color: t.label }} className="text-[13px] font-bold m-0 mb-1.5">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

function Bullets({ items }) {
  return (
    <ul className="m-0 pl-4 text-[13.5px] leading-relaxed">
      {items.map((it, i) => (
        <li key={i} className="mb-1 last:mb-0">
          {it}
        </li>
      ))}
    </ul>
  );
}

function Lead({ children }) {
  return <p className="text-[13px] text-[#6a7166] mt-0 mb-2.5 leading-relaxed">{children}</p>;
}

export default function GeneralInfo({ go }) {
  return (
    <div className="space-y-5">
      <Card style={{ background: `${BRAND.green}0f` }}>
        <p className="text-[13px] leading-relaxed m-0" style={{ color: BRAND.greenDark }}>
          ⛺ It's finally happening. Thursday is almost here and it's going to be an absolute
          banger. Read this carefully — there's a lot to know before you pack that tent! 🍺
        </p>
      </Card>

      <div>
        <SectionTitle icon={Hammer}>Build-up &amp; breakdown crew</SectionTitle>
        <Card>
          <Lead>
            A big thank you to everyone who volunteered to set up and pack down! This is what makes
            it all happen.
          </Lead>
          <Panel tone="green" title="Build-up — Thursday from 14:00">
            <p className="text-[13.5px] leading-relaxed m-0">{BUILD_CREW}</p>
          </Panel>
          <Panel tone="orange" title="Breakdown — Sunday 10:00 to 12:00 (terrain must be empty by 12:00!)">
            <p className="text-[13.5px] leading-relaxed m-0">{BREAK_CREW}</p>
          </Panel>
        </Card>
      </div>

      <div>
        <SectionTitle icon={Shirt}>Dress-up — not optional!</SectionTitle>
        <Card>
          <Lead>
            We have two themed evenings this weekend and yes, you are expected to show up in
            costume. No excuses, no "I forgot". Sort it before you leave home!
          </Lead>
          <Panel tone="green">
            <p className="text-[14px] font-bold m-0 mb-0.5">⛷️ Friday evening — Après-ski party</p>
            <p className="text-[13px] text-[#6a7166] m-0">
              Ski suits, goggles, beanies, fake slope glamour. Go all out, no half measures.
            </p>
          </Panel>
          <Panel tone="orange">
            <p className="text-[14px] font-bold m-0 mb-0.5">🏴‍☠️ Saturday evening — Cantus (pirate theme)</p>
            <p className="text-[13px] text-[#6a7166] m-0">
              The Cantus is a sacred Leverskade tradition. You WILL dress like a pirate.
            </p>
          </Panel>
        </Card>
      </div>

      <div>
        <SectionTitle icon={CalendarDays}>The full planning</SectionTitle>
        <Card>
          <Lead>Everything in one place — open it, save it, send it to yourself.</Lead>
          <p className="text-[13.5px] leading-relaxed mt-0 mb-3">
            The planning has the full schedule, timings and all the activities. It also includes a
            complete personal packing list so you know exactly what to throw in your bag. Just
            don't show up without reading it. 👇
          </p>
          <button
            onClick={() => go && go("planning")}
            style={{ background: BRAND.green }}
            className="w-full rounded-xl py-3 text-[14px] font-bold text-white"
          >
            📋 Open the Leverskade planning
          </button>
        </Card>
      </div>

      <div>
        <SectionTitle icon={Receipt}>What's included in your sign-up fee</SectionTitle>
        <Card>
          <Lead>
            Your fee covers more than you might think — but not everything. Here's the breakdown.
          </Lead>
          <Panel tone="green" title="✅ Included">
            <Bullets
              items={[
                "Your Leverskade shirt (plus extra merch if you ordered it) — handed out on location",
                "Camping stay for the full weekend",
                "The basics: coal for the BBQ, firewood, sauces, herbs, some cups and toilet paper",
                "Drinks for the beer olympics",
                <>
                  Cantus beer — <em>only if you chose the cantus beer option when signing up</em>
                </>,
              ]}
            />
          </Panel>
          <Panel tone="red" title="❌ Not included — bring your own!">
            <Bullets
              items={[
                "Your own drinks for the whole weekend. If you didn't pick the cantus beer option, bring plenty — we do a lot of bottoms up at the Cantus!",
                "Your own food, cutlery, plates and cup",
                "Everything else not listed above",
              ]}
            />
            <p className="text-[12.5px] text-[#6a7166] mt-2 mb-0">
              There will be a BBQ and a gas cooker available to use.
            </p>
          </Panel>
          <Panel tone="orange" title="🔥 Thursday BBQ — bring your own food!">
            <p className="text-[13.5px] leading-relaxed m-0">
              This one catches people out every year. We have the BBQs going with charcoal and fire
              provided, and someone will happily help you cook — but{" "}
              <b>everyone brings their own meat, veggies and drinks</b>. No food is provided and
              there's nothing shared to grab from.
            </p>
          </Panel>
        </Card>
      </div>

      <div>
        <SectionTitle icon={CreditCard}>Finances &amp; purchases — read this carefully</SectionTitle>
        <Card>
          <Lead>This is important. Please take a minute to read and understand it.</Lead>
          <Panel tone="red" title="🚫 No more collective Splitwise or Settle Up">
            <p className="text-[13.5px] leading-relaxed m-0">
              We will no longer use a shared Splitwise or Settle Up during the weekend. No group
              expenses, full stop.
            </p>
          </Panel>
          <Panel tone="orange" title="👑 Yoyo (Zoë) is financially responsible">
            <p className="text-[13.5px] leading-relaxed m-0">
              On behalf of the organisation, Yoyo handles all finances. No shared supplies or common
              goods are purchased for the group unless agreed with her in advance.
            </p>
          </Panel>
          <Panel tone="grey" title="❌ No purchases in the name of Leverskade">
            <p className="text-[13.5px] leading-relaxed m-0">
              Nobody else may buy things in the name of Leverskade. Anything outside the sign-up
              options is your own personal expense.
            </p>
            <p className="text-[13px] text-[#6a7166] leading-relaxed mt-2 mb-0">
              If you buy drinks or food for a few friends, agree on it upfront and settle it between
              yourselves. A private Splitwise between you and those friends is fine — just not under
              the Leverskade name.
            </p>
          </Panel>
        </Card>
      </div>

      <div>
        <SectionTitle icon={Thermometer}>Pack warm — it gets cold at night!</SectionTitle>
        <Card>
          <Lead>
            Don't be that person shivering in the tent at 3am. The terrain gets surprisingly cold
            after dark.
          </Lead>
          <Bullets
            items={[
              "A proper sleeping bag (not a thin summer one — a real, warm one)",
              "An extra blanket. Seriously. Bring one.",
              "Warm clothes for the night: hoodie, joggers, thick socks",
              "A waterproof jacket for when the temperature really drops",
            ]}
          />
        </Card>
      </div>

      <div>
        <SectionTitle icon={Package}>Event supplies — don't forget your stuff!</SectionTitle>
        <p className="text-[12.5px] text-[#8a9186] -mt-2 mb-2 leading-relaxed">
          The logistics team has you covered for the big gear — but only if you actually bring what
          you signed up for. These people told us they'd bring these items. Double check your list
          before you leave!
        </p>
        <Card>
          <ul className="m-0 p-0 list-none divide-y" style={{ borderColor: BRAND.mint }}>
            {SUPPLIES.map((p) => (
              <li key={p.name} className="py-2.5 first:pt-0 last:pb-0">
                <p
                  style={{ color: p.star ? BRAND.orangeDark : BRAND.greenDark }}
                  className="text-[12px] font-bold uppercase tracking-wide m-0 mb-1"
                >
                  {p.star ? "🌟 " : ""}
                  {p.name}
                </p>
                <p className="text-[13px] leading-relaxed m-0">{p.items}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div>
        <SectionTitle icon={Bug}>Ticks — there are a lot in Germany this summer</SectionTitle>
        <Card style={{ borderColor: "#ffb74d" }}>
          <Lead>A few simple habits will keep you safe and tick-free all weekend.</Lead>
          <Bullets
            items={[
              "Apply insect repellent before heading into grass or wooded areas",
              "Wear long trousers and tuck them into your socks when walking through tall grass",
              "Do a full body check every evening — armpits, behind the knees, hairline and groin are their favourite spots",
              "If you find a tick: tweezers, grip close to the skin, pull straight out without squeezing the body",
              "Keep an eye on the bite area over the following weeks — a spreading red ring means see a doctor",
              "Germany has TBE risk areas. If you're not vaccinated and feel unwell after a bite, mention it to a doctor",
            ]}
          />
          <p className="text-[12.5px] text-[#6a7166] mt-2 mb-0">
            Your mosquito spray (already on the personal packing list!) works against ticks too —
            use it generously.
          </p>
        </Card>
      </div>

      <p className="text-center text-[13px] font-bold pt-1" style={{ color: BRAND.greenDark }}>
        ⛺ See you Thursday. It's going to be legendary. 🍺🎉
      </p>
    </div>
  );
}
