"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export function AuthButtons() {
  const { data: session, isPending } = authClient.useSession();

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.reload();
        },
      },
    });
  };

  if (isPending) {
    return <div className="h-8 w-28 animate-pulse bg-muted rounded-md" />;
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground hidden sm:inline-block">
          {session.user.name || session.user.email}
        </span>
        <Button variant="outline" size="sm" onClick={handleSignOut}>
          Sign Out
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/login"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        Login
      </Link>
      <Link
        href="/signup"
        className={cn(buttonVariants({ variant: "default", size: "sm" }))}
      >
        Sign Up
      </Link>
    </div>
  );
}
