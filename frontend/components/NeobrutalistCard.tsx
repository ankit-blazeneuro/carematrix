import React from "react";

interface NeobrutalistCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  title?: string;
  badge?: string;
  badgeColor?: "red" | "black" | "white" | "muted" | "yellow" | "green" | "blue";
}

export function NeobrutalistCard({
  children,
  className = "",
  title,
  badge,
  badgeColor = "black",
  ...props
}: NeobrutalistCardProps) {
  const badgeColorClass = {
    red: "neo-badge-red",
    black: "neo-badge-black",
    white: "neo-badge-white",
    muted: "neo-badge-muted",
    yellow: "neo-badge-black",
    green: "neo-badge-red",
    blue: "neo-badge-white",
  }[badgeColor];

  return (
    <div className={`neo-card ${className}`} {...props}>
      {(title || badge) && (
        <div className="flex items-center justify-between border-b-2 border-[var(--ink)] pb-3 mb-4">
          {title && (
            <h3 className="font-display text-xl font-bold uppercase tracking-wider text-[var(--ink)]">
              {title}
            </h3>
          )}
          {badge && (
            <span className={`neo-badge ${badgeColorClass}`}>
              {badge}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
