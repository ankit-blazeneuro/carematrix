"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { CareMatrixLogo } from "@/components/logo";
import { AuthButtons } from "@/components/auth-buttons";

const AUTH_ROUTES = ["/login", "/signup"];

export default function Navbar() {
  const pathname = usePathname();

  if (AUTH_ROUTES.includes(pathname)) {
    return null;
  }

  return (
    <div className="w-full flex justify-center px-6 pt-5">
      <nav className="w-[90%] flex items-center justify-between px-6 py-3 rounded-xl border border-border bg-background/60 backdrop-blur-md shadow-sm">
        {/* Logo - Left */}
        <Link href="/" aria-label="CareMatrix Home" className="ml-6">
          <CareMatrixLogo className="w-8 h-8" />
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2 mr-6">
          <ThemeToggle />
          <AuthButtons />
        </div>
      </nav>
    </div>
  );
}
