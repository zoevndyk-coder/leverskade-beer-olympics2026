import React from "react";

export const BRAND = {
  cream: "#FBF8EF",
  green: "#0F7A38",
  greenDark: "#0B5C2A",
  mint: "#D7EEDA",
  orange: "#FFA933",
  orangeDark: "#DE8A17",
  ink: "#233020",
};

export function SectionTitle({ children, icon: Icon }) {
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

export function Card({ children, style }) {
  return (
    <div
      style={{ border: `1.5px solid ${BRAND.mint}`, ...style }}
      className="bg-white rounded-2xl p-4 shadow-[0_2px_10px_rgba(15,122,56,0.06)]"
    >
      {children}
    </div>
  );
}

export function EmptyHint({ text }) {
  return <p className="text-[13px] text-[#8a9186] text-center py-2 m-0">{text}</p>;
}
