import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { CareMatrixLogo } from "@/components/logo";

export default function Navbar() {
  return (
    <div className="w-full flex justify-center px-6 pt-5">
      <nav className="w-full max-w-5xl flex items-center justify-between px-6 py-3 rounded-xl bg-background/60 backdrop-blur-md shadow-sm">
        {/* Logo - Left */}
        <Link href="/" className="flex items-center gap-2">
          <CareMatrixLogo className="w-6 h-6 text-blue-600" />
          <span className="text-xl font-bold tracking-tight text-foreground">
            Care<span className="text-blue-600">Matrix</span>
          </span>
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
