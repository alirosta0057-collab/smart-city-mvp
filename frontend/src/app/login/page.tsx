"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowRight, LogIn, Sparkles } from "lucide-react";
import { useAuth, homeForRole } from "@/lib/auth";
import { ApiError } from "@/lib/api";
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

const DEMO = [
  {
    role: "Citizen",
    email: "citizen@smartcity.example",
    pass: "pass123",
    tint: "bg-primary/10 text-primary",
  },
  {
    role: "Agent",
    email: "agent@smartcity.example",
    pass: "pass123",
    tint: "bg-success/10 text-success",
  },
  {
    role: "Admin",
    email: "admin@smartcity.example",
    pass: "admin123",
    tint: "bg-warning/15 text-warning",
  },
];

function LoginInner() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const prefillEmail = params?.get("email") ?? "";
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (prefillEmail) setEmail(prefillEmail);
  }, [prefillEmail]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const u = await login(email, password);
      toast({
        variant: "success",
        title: `Welcome, ${u.full_name}`,
        description: `Signed in as ${u.role}.`,
      });
      router.replace(homeForRole(u.role));
    } catch (err) {
      const msg = err instanceof ApiError ? err.detail : "Login failed";
      setError(msg);
      toast({ variant: "destructive", title: "Login failed", description: msg });
    } finally {
      setLoading(false);
    }
  }

  const quickFill = (email: string, pass: string) => {
    setEmail(email);
    setPassword(pass);
  };

  return (
    <div className="relative isolate mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center gap-8 px-4 py-10 md:grid-cols-2 md:gap-12">
      <div className="absolute -top-20 left-1/2 -z-10 h-64 w-[60%] -translate-x-1/2 bg-gradient-brand opacity-20 blur-3xl" />
      <div className="hidden space-y-6 md:block">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium">Smart City control center</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
          Welcome back.
        </h1>
        <p className="text-muted-foreground">
          Sign in to your portal. Citizens manage tickets, agents work the
          queue, admins oversee the city.
        </p>
        <div className="space-y-2">
          {DEMO.map((d) => (
            <button
              key={d.email}
              onClick={() => quickFill(d.email, d.pass)}
              className="group flex w-full items-center justify-between rounded-xl border bg-card p-3 text-left transition-all hover:border-primary/40 hover:shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-lg font-semibold ${d.tint}`}
                >
                  {d.role[0]}
                </span>
                <div>
                  <div className="font-medium">{d.role}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {d.email}
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      </div>

      <Card className="border-border/60 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <LogIn className="h-5 w-5" /> Log in
          </CardTitle>
          <CardDescription>
            Use one of the demo accounts on the left, or sign in with your own.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoFocus
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
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
              {loading ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              New here?{" "}
              <Link className="font-medium text-primary hover:underline" href="/register">
                Create an account
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
