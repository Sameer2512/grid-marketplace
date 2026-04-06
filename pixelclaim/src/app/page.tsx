import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

// Phase 0 verification page.
// Will be replaced with the full grid homepage in Phase 4.
export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">PixelClaim</h1>
        <p className="text-muted-foreground text-lg">
          Own a piece of the internet.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        {/* Show sign-in/up buttons to unauthenticated users */}
        <Show when="signed-out">
          <div className="flex gap-3">
            <Button render={<Link href="/sign-in" />}>Sign In</Button>
            <Button variant="outline" render={<Link href="/sign-up" />}>
              Sign Up
            </Button>
          </div>
        </Show>

        {/* Show profile controls to authenticated users */}
        <Show when="signed-in">
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Signed in — auth is working.
            </p>
            <UserButton />
          </div>
        </Show>
      </div>

      <p className="text-xs text-muted-foreground">Phase 0 — Foundation ✓</p>
    </main>
  );
}
