import { ArrowUpRight } from "lucide-react";
import { Signal } from "@/lib/types";
import { RegionBadge, ScoreBar, SignalBadge, SourceBadge } from "@/components/badges";
import { formatRelativeDate } from "@/lib/utils";

export function SignalCard({
  signal,
  labels,
  locale
}: {
  signal: Signal;
  labels: { topSignal: string; strongSignal: string; watch: string };
  locale: "zh" | "en";
}) {
  return (
    <article className="panel p-5">
      <div className="flex flex-wrap items-center gap-2">
        <RegionBadge region={signal.region} />
        <SourceBadge sourceType={signal.sourceType} />
        <SignalBadge
          score={signal.signalScore}
          labels={{ top: labels.topSignal, strong: labels.strongSignal, watch: labels.watch }}
        />
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-ink">{signal.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{signal.summary}</p>
        </div>
        <a
          href={signal.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowUpRight className="h-4 w-4" />
        </a>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {signal.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-5 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="font-medium text-slate-700">{signal.company}</span>
          {" · "}
          {signal.sourceName}
          {" · "}
          {formatRelativeDate(signal.publishedAt, locale)}
        </div>
        <ScoreBar score={signal.signalScore} />
      </div>
    </article>
  );
}
