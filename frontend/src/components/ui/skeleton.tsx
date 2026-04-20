import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-[shimmer_1.6s_linear_infinite] rounded-md bg-[linear-gradient(110deg,hsl(var(--muted))_30%,hsl(var(--border))_50%,hsl(var(--muted))_70%)] bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}
