import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { CareMatrixLogo } from "@/components/logo";

export default function Navbar() {
  return (
    <div className="w-full flex justify-center px-6 pt-5">
      <nav className="w-[90%] flex items-center justify-between px-6 py-3 rounded-xl border border-border bg-background/60 backdrop-blur-md shadow-sm">
        {/* Logo - Left */}
        <Link href="/" aria-label="CareMatrix Home">
          <CareMatrixLogo className="w-8 h-8" />
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" asChild>
            <Link href="/login">Login</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/signup">Sign Up</Link>
          </Button>
        </div>
      </nav>
    </div>
  );
}
