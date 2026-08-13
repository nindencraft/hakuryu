import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { discordAvatarUrl } from "@/lib/permissions";

export function GoldRule({ className }: { className?: string }) {
  return <div className={cn("rule-gold my-6", className)} aria-hidden />;
}

export function PageTitle({
  kanji,
  title,
  subtitle,
  actions,
}: {
  kanji?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-baseline gap-3">
          <h1 className="text-gold-gradient text-3xl font-semibold sm:text-4xl">{title}</h1>
          {kanji ? (
            <span className="font-jp text-lg text-muted-foreground" aria-hidden>
              {kanji}
            </span>
          ) : null}
        </div>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="card-gold relative overflow-hidden p-5">
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ background: "var(--gradient-gold)" }}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            {label}
          </p>
          <p className="font-display mt-2 text-4xl leading-none text-foreground">{value}</p>
          {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {icon ? <div className="text-primary/70">{icon}</div> : null}
      </div>
    </div>
  );
}

export function MemberAvatar({
  discordId,
  avatarHash,
  size = 48,
  alt,
}: {
  discordId: string;
  avatarHash: string | null | undefined;
  size?: number;
  alt: string;
}) {
  return (
    <img
      src={discordAvatarUrl(discordId, avatarHash, 128)}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      className="ring-gold shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/60 px-6 py-12 text-center">
      <p className="font-display text-lg text-foreground">{title}</p>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
