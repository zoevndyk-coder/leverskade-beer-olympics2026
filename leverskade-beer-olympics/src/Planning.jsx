import React, { useState } from "react";
import { CalendarDays, Backpack, Trophy } from "lucide-react";
import { BRAND, Card, SectionTitle } from "./ui.jsx";

const KOMOOT =
  "https://www.komoot.com/tour/3176370554?share_token=agXzoiGZPHLi3xo453twtRTb38m0GpXtBkZbqVKiAiA3E9TMe6&ref=wtd&t_s=referral&t_cid=route_share&t_ref_username=6053409443853";

const DAYS = [
  {
    id: "thu",
    tab: "Thu",
    date: "THU · 03/09",
    heading: "🌲 Arrive · BBQ · Campfire",
    items: [
      {
        time: "FROM 14:00",
        title: "Arrival & Set-up",
        body: "Pitch your tent, crack open a drink & let Leverskade begin.",
      },
      {
        time: "ALL WEEKEND",
        title: "🔪 Killing Game",
        body: "Grab the paper with your name, find your target & trust no one. Ends after Saturday's Cantus.",
        accent: true,
      },
      {
        time: "18:00",
        title: "BBQ — bring your own food!",
        body: "We provide the BBQs, the charcoal and the fire, and someone will help you cook. You bring your own meat, veggies and drinks — food is NOT provided.",
        warn: "⚠️ Nobody is cooking for you and there's no shared food. Turn up with your own dinner or you'll be watching everyone else eat.",
        accent: true,
      },
      {
        time: "AFTER DINNER",
        title: "Campfire",
        body: "Marshmallows are on us!",
      },
    ],
  },
  {
    id: "fri",
    tab: "Fri",
    date: "FRI · 04/09",
    heading: "🍻 Hike · Beer Olympics · Après-Ski",
    items: [
      {
        time: "12:00–14:00",
        title: "Nature Hike",
        body: "±6 km · Easy · Hiking shoes · Sporty clothes · Water bottle",
        link: { href: KOMOOT, label: "View route on Komoot →" },
      },
      {
        time: "15:30",
        title: "🏆 Beer Olympics",
        body: "Flip Cup · Beer Pong · Rage Cage Battle · Flunkyball · Cornhole · Kubb · Frisbee · Tug of War · Darts · Pétanque",
        note: "BYOD",
        accent: true,
      },
      {
        time: "21:00",
        title: "Winner Announcement",
        prizes: [
          ["Overall Champion", "most overall points"],
          ["Best Sprinter", "highest score in 1 category"],
          ["Trick Shot Champion", "most trick shot wins"],
          ["Beer Pong Champions", "team that wins the beer pong tournament"],
        ],
      },
      {
        time: "22:00",
        title: "⛷️ Summer Après-Ski Party",
        body: "Dress-up: Après-ski · Ski suits · Goggles · Lederhosen · Dirndls · Retro ski gear",
      },
    ],
  },
  {
    id: "sat",
    tab: "Sat",
    date: "SAT · 05/09",
    heading: "⛵ Swim · Monschau · Pirate Cantus",
    items: [
      { time: "11:00", title: "Swimming — Vennbad Monschau", body: "Swimsuit + towel" },
      {
        time: "13:00–16:30",
        title: "Monschau",
        body: "Explore the city + Festival of Diversity · Live music · Food · Performances · Activities",
      },
      { time: "DURING MONSCHAU", title: "📸 Group Photo" },
      {
        time: "17:00",
        title: "Back at Camp",
        body: "Dinner · Chill · Get your pirate outfit on.",
      },
      {
        time: "19:00 SHARP",
        title: "🏴‍☠️ Pirate Cantus",
        body: "Dress-up: Pirates",
        warn: "⚠️ Be on time, seated, ready & dressed in theme. Everyone staying at camp during the Cantus joins. Alcohol-free drinks & water are absolutely fine.",
        sub: "Drinks: Cantus Beer Option = beer provided · Otherwise BYOD · Strong liquor not recommended.",
        accent: true,
      },
      {
        time: "END OF CANTUS",
        title: "🏅 Killing Game Finale",
        body: "The winner receives the LEVERSKADE DEADLIEST KILLER 2026 medal.",
      },
    ],
  },
  {
    id: "sun",
    tab: "Sun",
    date: "SUN · 06/09",
    heading: "☀️ Recover · Pack · Goodbye",
    items: [
      {
        time: "MORNING",
        title: "Slow Start",
        body: "Sleep in · Breakfast · One last dip · Pack up",
      },
      {
        time: "BEFORE 12:00",
        title: "Leave Campsite",
        body: "Everything packed, campsite cleared & time to head home.",
        accent: true,
      },
    ],
  },
];

const PACKING = [
  {
    title: "Sleep & Camp",
    items: [
      "Tent",
      "Ground Anchors",
      "Mattress",
      "Air Pump",
      "Sleeping Bag",
      "Camping Chair",
      "Camping Light / Headlamp",
    ],
  },
  {
    title: "Eating & Drinking",
    items: [
      "Cutlery",
      "Cup",
      "Plate",
      "Food & Drinks for Yourself",
      "Reusable Water Bottle",
      "Gas Cooker (optional, handy since we're a big group)",
    ],
  },
  {
    title: "Swim & Wear",
    items: [
      "Swim Suit",
      "Towel",
      "Comfortable Clothes",
      "Hat or Cap",
      "Warm Sweater",
      "Sunglasses",
      "Waterproof Jacket",
    ],
  },
  {
    title: "Hygiene & Health",
    items: [
      "Toothbrush and Toothpaste",
      "Shower Gel",
      "Toilet Paper",
      "Mosquito Spray",
      "Sunscreen",
      "Earplugs (if you're a light sleeper)",
    ],
  },
  {
    title: "Don't Forget",
    items: ["Phone", "Charger", "Powerbank", "ID", "Costumes", "Games (optional)"],
  },
];

function Entry({ it }) {
  return (
    <div
      style={{
        borderLeft: `3px solid ${it.accent ? BRAND.orange : BRAND.mint}`,
      }}
      className="pl-3 py-1.5 mb-3 last:mb-0"
    >
      <div
        style={{ color: it.accent ? BRAND.orangeDark : "#8a9186" }}
        className="text-[10.5px] font-bold tracking-wide uppercase mb-0.5"
      >
        {it.time}
      </div>
      <div
        style={{ fontFamily: "'Baloo 2', sans-serif", color: BRAND.greenDark }}
        className="text-[14.5px] font-bold leading-snug"
      >
        {it.title}
      </div>
      {it.body && <p className="text-[13px] leading-relaxed m-0 mt-0.5">{it.body}</p>}
      {it.note && (
        <span
          style={{ background: BRAND.mint, color: BRAND.greenDark }}
          className="inline-block text-[10.5px] font-bold rounded-full px-2 py-0.5 mt-1.5"
        >
          {it.note}
        </span>
      )}
      {it.link && (
        <a
          href={it.link.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: BRAND.green }}
          className="inline-block text-[12.5px] font-bold mt-1.5 underline"
        >
          {it.link.label}
        </a>
      )}
      {it.warn && (
        <p
          style={{ background: "#fff3e0", color: "#b45309" }}
          className="text-[12px] leading-relaxed rounded-lg px-2.5 py-2 mt-2 mb-0"
        >
          {it.warn}
        </p>
      )}
      {it.sub && <p className="text-[12px] text-[#6a7166] m-0 mt-1.5">{it.sub}</p>}
      {it.prizes && (
        <div className="mt-2 space-y-1">
          {it.prizes.map(([name, why]) => (
            <div key={name} className="text-[12.5px] leading-snug">
              <span style={{ color: BRAND.orangeDark }} className="font-bold">
                {name}
              </span>{" "}
              <span className="text-[#6a7166]">— {why}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Planning() {
  const [day, setDay] = useState("thu");
  const current = DAYS.find((d) => d.id === day) || DAYS[0];

  return (
    <div className="space-y-5">
      <Card style={{ background: `${BRAND.green}0f` }}>
        <p className="text-[13px] leading-relaxed m-0" style={{ color: BRAND.greenDark }}>
          📅 The full run-down — schedule, timings and everything to pack.
        </p>
      </Card>

      <div>
        <SectionTitle icon={CalendarDays}>Weekend Program</SectionTitle>

        <div className="flex gap-1.5 mb-3">
          {DAYS.map((d) => {
            const on = d.id === day;
            return (
              <button
                key={d.id}
                onClick={() => setDay(d.id)}
                style={{
                  background: on ? BRAND.green : "#fff",
                  color: on ? "#fff" : BRAND.greenDark,
                  border: `1.5px solid ${on ? BRAND.green : BRAND.mint}`,
                }}
                className="flex-1 rounded-lg py-2 text-[13px] font-bold"
              >
                {d.tab}
              </button>
            );
          })}
        </div>

        <Card>
          <div className="mb-3">
            <div
              style={{ color: BRAND.orangeDark }}
              className="text-[11px] font-bold tracking-wide uppercase"
            >
              {current.date}
            </div>
            <div
              style={{ fontFamily: "'Baloo 2', sans-serif", color: BRAND.greenDark }}
              className="text-[15px] font-bold"
            >
              {current.heading}
            </div>
          </div>
          {current.items.map((it, i) => (
            <Entry key={i} it={it} />
          ))}
        </Card>
      </div>

      <div>
        <SectionTitle icon={Backpack}>What to Pack</SectionTitle>
        <p className="text-[12.5px] text-[#8a9186] -mt-2 mb-2">
          Everything you need for four days in the woods.
        </p>
        <div className="space-y-3">
          {PACKING.map((g) => (
            <Card key={g.title}>
              <div
                style={{ fontFamily: "'Baloo 2', sans-serif", color: BRAND.greenDark }}
                className="text-[14px] font-bold mb-2"
              >
                {g.title}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map((i) => (
                  <span
                    key={i}
                    style={{ background: BRAND.mint, color: BRAND.greenDark }}
                    className="text-[12px] font-semibold rounded-full px-2.5 py-1"
                  >
                    {i}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Card style={{ background: `${BRAND.orange}14` }}>
        <div className="text-center py-1">
          <div
            style={{ fontFamily: "'Baloo 2', sans-serif", color: BRAND.orangeDark }}
            className="text-[15px] font-extrabold"
          >
            💛 See you at Leverskade 2026
          </div>
          <p className="text-[12.5px] text-[#6a7166] m-0 mt-1">
            Four days · One campsite · Questionable decisions · Let's make it a good one.
          </p>
        </div>
      </Card>
    </div>
  );
}
