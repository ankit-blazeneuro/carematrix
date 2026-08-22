import React from "react";

interface NeobrutalistButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "red" | "black" | "white" | "yellow" | "green" | "blue";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function NeobrutalistButton({
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...props
}: NeobrutalistButtonProps) {
  const variantClass = {
    primary: "neo-button",
    red: "neo-button neo-button-red",
    black: "neo-button neo-button-black",
    white: "neo-button neo-button-white",
    yellow: "neo-button bg-black text-white hover:bg-neutral-800",
    green: "neo-button neo-button-red",
    blue: "neo-button neo-button-black",
  }[variant];

  const sizeClass = {
    sm: "px-3 py-1 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  }[size];

  return (
    <button
      className={`${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
