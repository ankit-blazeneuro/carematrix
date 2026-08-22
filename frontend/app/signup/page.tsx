import Link from "next/link";
import { SignupForm } from "@/components/signup-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { CareMatrixLogo } from "@/components/logo";
import { ArrowLeft } from "lucide-react";

export default function SignupPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Top action bar */}
      <div className="flex items-center justify-between px-6 pt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to home</span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Main card */}
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm space-y-4">
          <div className="flex justify-center mb-2">
            <Link href="/" aria-label="CareMatrix Home">
              <CareMatrixLogo className="w-10 h-10" />
            </Link>
          </div>
          <SignupForm />
        </div>
      </div>
    </div>
  );
}
