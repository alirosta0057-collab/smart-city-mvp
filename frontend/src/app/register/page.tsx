"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Sparkles, UserPlus } from "lucide-react";
import { useAuth, homeForRole } from "@/lib/auth";
import { ApiError, type UserRole } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("citizen");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const u = await register(email, password, fullName, role);
      toast({
        variant: "success",
        title: `Account created`,
        description: `Welcome, ${u.full_name}!`,
      });
      router.replace(homeForRole(u.role));
    } catch (err) {
      const msg = err instanceof ApiError ? err.detail : "Sign up failed";
      setError(msg);
      toast({ variant: "destructive", title: "Sign up failed", description: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative isolate mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center gap-8 px-4 py-10 md:grid-cols-2 md:gap-12">
      <div className="absolute -top-20 left-1/2 -z-10 h-64 w-[60%] -translate-x-1/2 bg-gradient-brand opacity-20 blur-3xl" />
      <div className="hidden space-y-6 md:block">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium">Join the city</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
          Create your account.
        </h1>
        <p className="text-muted-foreground">
          Register as a <strong>citizen</strong> to request services, or as an{" "}
          <strong>agent</strong> to answer them. Admin accounts are provisioned
          separately.
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Free for the demo — no credit card.</li>
          <li>• Your email is only used for sign-in.</li>
          <li>• You can switch portals anytime by signing in with another role.</li>
        </ul>
      </div>

      <Card className="border-border/60 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <UserPlus className="h-5 w-5" /> Create account
          </CardTitle>
          <CardDescription>
            It takes under a minute. Pick a role and you&apos;re in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                required
                value={fullName}
                autoComplete="name"
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { v: "citizen", label: "Citizen" },
                    { v: "agent", label: "Agent" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setRole(opt.v)}
                    className={
                      "rounded-lg border p-3 text-left text-sm transition-colors " +
                      (role === opt.v
                        ? "border-primary bg-primary/5 ring-2 ring-primary/40"
                        : "hover:border-primary/40")
                    }
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {opt.v === "citizen"
                        ? "Request services"
                        : "Answer citizen tickets"}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {error ? (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}
            <Button
              type="submit"
              disabled={loading}
              variant="brand"
              size="lg"
              className="w-full"
            >
              {loading ? "Creating account…" : "Create account"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link className="font-medium text-primary hover:underline" href="/login">
                Log in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
