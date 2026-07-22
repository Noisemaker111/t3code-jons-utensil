import { useEffect, useMemo, useState } from "react";
import { ActivityIcon, ExternalLinkIcon } from "lucide-react";

import type { ScopedThreadRef } from "@t3tools/contracts";
import { useComposerDraftStore } from "../composerDraftStore";
import { cn } from "~/lib/utils";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

const OPENUSAGE_LIMITS_URL = "http://127.0.0.1:6736/v1/limits";
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

type UsageResource = {
  kind?: "consumption" | "balance";
  unit?: string;
  used?: number;
  limit?: number;
  remaining?: number;
  available?: number;
  utilization?: number;
  resetsAt?: string;
};

type UsageProvider = {
  displayName?: string;
  plan?: string;
  fetchedAt?: string;
  stale?: boolean;
  resources?: Record<string, UsageResource>;
};

type UsageResponse = {
  providers?: Record<string, UsageProvider>;
  errors?: Array<{ providerId?: string; message?: string }>;
};

type UsageEntry = UsageProvider & { id: string };

function providerFamily(providerId: string | null): string | null {
  if (!providerId) return null;
  return providerId.split(/[_-]/u, 1)[0] ?? providerId;
}

function providerForSelection(
  providers: ReadonlyArray<UsageEntry>,
  selectedProviderId: string | null,
): UsageEntry | null {
  if (!selectedProviderId) return null;
  return (
    providers.find((provider) => provider.id === selectedProviderId) ??
    providers.find((provider) => provider.id === providerFamily(selectedProviderId)) ??
    null
  );
}

function primaryResource(provider: UsageEntry | null): UsageResource | null {
  if (!provider?.resources) return null;
  const preferredIds = [
    "session",
    "weekly",
    "daily",
    "totalUsage",
    "monthly",
    "credits",
    "balance",
  ];
  const resource = preferredIds.map((id) => provider.resources?.[id]).find(Boolean);
  return resource ?? Object.values(provider.resources)[0] ?? null;
}

function utilization(resource: UsageResource | null): number | null {
  if (!resource) return null;
  if (typeof resource.utilization === "number")
    return Math.max(0, Math.min(1, resource.utilization));
  if (
    typeof resource.used === "number" &&
    typeof resource.limit === "number" &&
    resource.limit > 0
  ) {
    return Math.max(0, Math.min(1, resource.used / resource.limit));
  }
  return null;
}

function usageColor(value: number | null): string {
  if (value === null) return "#71717a";
  if (value >= 0.8) return "#ef4444";
  if (value >= 0.6) return "#eab308";
  return "#22c55e";
}

function formatResourceValue(resource: UsageResource): string {
  if (resource.kind === "balance" && typeof resource.available === "number") {
    return `${resource.available.toLocaleString()} ${resource.unit ?? "available"}`;
  }
  if (typeof resource.used === "number" && typeof resource.limit === "number") {
    const unit = resource.unit === "percent" ? "%" : ` ${resource.unit ?? "used"}`;
    return `${resource.used.toLocaleString()} / ${resource.limit.toLocaleString()}${unit}`;
  }
  if (typeof resource.available === "number") {
    return `${resource.available.toLocaleString()} ${resource.unit ?? "available"}`;
  }
  return "No current value";
}

function formatReset(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `Resets ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function UsageRing({
  resource,
  size = "sm",
}: {
  resource: UsageResource | null;
  size?: "sm" | "lg";
}) {
  const value = utilization(resource);
  const percent = value === null ? 0 : Math.round(value * 100);
  const color = usageColor(value);
  const diameter = size === "lg" ? 72 : 30;
  return (
    <div
      aria-label={value === null ? "Usage unavailable" : `${percent}% usage`}
      className={cn("relative shrink-0 rounded-full", size === "lg" ? "size-[72px]" : "size-7")}
      role="img"
      style={{
        background:
          value === null
            ? "conic-gradient(#3f3f46 0 100%)"
            : `conic-gradient(${color} 0 ${percent}%, transparent ${percent}% 100%)`,
      }}
    >
      <div
        className="absolute inset-[3px] flex items-center justify-center rounded-full bg-card text-[9px] font-semibold tabular-nums text-foreground"
        style={{ fontSize: size === "lg" ? 14 : 9 }}
      >
        {value === null ? "—" : `${percent}%`}
      </div>
      <span className="sr-only">{diameter}</span>
    </div>
  );
}

function UsageProviderRow({ provider }: { provider: UsageEntry }) {
  const resources = Object.entries(provider.resources ?? {});
  return (
    <section className="rounded-xl border border-border/70 bg-background/45 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium">{provider.displayName ?? provider.id}</h3>
          <p className="text-xs text-muted-foreground">{provider.plan ?? provider.id}</p>
        </div>
        <UsageRing resource={primaryResource(provider)} size="lg" />
      </div>
      <div className="space-y-2">
        {resources.map(([id, resource]) => {
          const value = utilization(resource);
          return (
            <div key={id} className="rounded-lg bg-muted/35 px-2.5 py-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="capitalize text-muted-foreground">
                  {id.replace(/([A-Z])/gu, " $1")}
                </span>
                <span className="font-medium tabular-nums">{formatResourceValue(resource)}</span>
              </div>
              {value !== null ? (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{
                      backgroundColor: usageColor(value),
                      width: `${Math.round(value * 100)}%`,
                    }}
                  />
                </div>
              ) : null}
              {formatReset(resource.resetsAt) ? (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {formatReset(resource.resetsAt)}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function UsageIndicator({ threadRef }: { threadRef: ScopedThreadRef | null }) {
  const selectedProviderId = useComposerDraftStore(
    (state) =>
      (threadRef ? state.getComposerDraft(threadRef)?.activeProvider : null) ??
      state.stickyActiveProvider,
  );
  const [data, setData] = useState<UsageResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      setIsRefreshing(true);
      try {
        const response = await fetch(OPENUSAGE_LIMITS_URL);
        if (!response.ok) throw new Error(`OpenUsage returned ${response.status}`);
        const next = (await response.json()) as UsageResponse;
        if (!cancelled) setData(next);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setIsRefreshing(false);
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const providers = useMemo<ReadonlyArray<UsageEntry>>(
    () => Object.entries(data?.providers ?? {}).map(([id, provider]) => ({ id, ...provider })),
    [data],
  );
  const selectedProvider = providerForSelection(providers, selectedProviderId);
  const selectedResource = primaryResource(selectedProvider);
  const selectedName =
    selectedProvider?.displayName ?? providerFamily(selectedProviderId) ?? "Provider";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            aria-label={`Open usage for ${selectedName}`}
            className="size-8 shrink-0 rounded-full p-0"
            title={`Usage: ${selectedName}`}
            variant="ghost"
          />
        }
      >
        <UsageRing resource={selectedResource} />
      </DialogTrigger>
      <DialogPopup className="max-w-xl" showCloseButton>
        <DialogHeader className="border-b border-border/70 pb-4">
          <div className="flex items-center gap-3">
            <ActivityIcon className="size-4 text-muted-foreground" />
            <div>
              <DialogTitle>AI usage</DialogTitle>
              <DialogDescription>
                Live limits from OpenUsage for every detected provider.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="min-h-0 space-y-3 overflow-y-auto p-4">
          {providers.length > 0 ? (
            providers.map((provider) => <UsageProviderRow key={provider.id} provider={provider} />)
          ) : (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm font-medium">OpenUsage isn&apos;t available yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Start OpenUsage to read local provider limits here. No credentials are sent by T3
                Code.
              </p>
            </div>
          )}
          {data?.errors?.length ? (
            <p className="text-xs text-muted-foreground">
              {data.errors.length} provider refresh failed; showing last known data where available.
            </p>
          ) : null}
        </div>
        <DialogFooter className="items-center sm:justify-between">
          <span className="text-[11px] text-muted-foreground">
            {isRefreshing ? "Refreshing…" : "Refreshes every 5 minutes"}
          </span>
          <div className="flex gap-2">
            <Button
              render={
                <a
                  href="https://github.com/robinebers/openusage"
                  target="_blank"
                  rel="noreferrer"
                />
              }
              size="sm"
              variant="ghost"
            >
              OpenUsage <ExternalLinkIcon />
            </Button>
            <DialogClose render={<Button size="sm">Done</Button>} />
          </div>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
