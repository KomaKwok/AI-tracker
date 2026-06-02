import { PriceSnapshotEntry } from "@/lib/data/pricing-snapshot";

function formatDate(value: string | null | undefined, locale: "zh" | "en") {
  if (!value) {
    return locale === "zh" ? "暂无记录" : "No record";
  }

  return new Date(value).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function getRecencyTone(value: string | null | undefined) {
  if (!value) {
    return {
      dot: "bg-slate-300",
      pill: "bg-slate-100 text-slate-600",
      labelZh: "暂无记录",
      labelEn: "No record"
    };
  }

  const days = (Date.now() - +new Date(value)) / (24 * 60 * 60 * 1000);
  if (days <= 3) {
    return {
      dot: "bg-emerald-500",
      pill: "bg-emerald-50 text-emerald-700",
      labelZh: "刚核对",
      labelEn: "Recently checked"
    };
  }

  if (days <= 14) {
    return {
      dot: "bg-amber-500",
      pill: "bg-amber-50 text-amber-700",
      labelZh: "两周内核对",
      labelEn: "Checked in 2 weeks"
    };
  }

  return {
    dot: "bg-slate-300",
    pill: "bg-slate-100 text-slate-600",
    labelZh: "较早核对",
    labelEn: "Checked earlier"
  };
}

const brandStyles: Record<string, string> = {
  OpenAI: "from-slate-950 to-slate-800",
  Anthropic: "from-orange-700 to-stone-700",
  Google: "from-blue-700 via-sky-600 to-emerald-600",
  DeepSeek: "from-blue-700 to-cyan-700",
  MiniMax: "from-fuchsia-700 to-pink-700",
  "豆包 / 方舟": "from-emerald-700 to-teal-700"
};

export function PriceBoard({
  entries,
  locale
}: {
  entries: PriceSnapshotEntry[];
  locale: "zh" | "en";
}) {
  const copy =
    locale === "zh"
      ? {
          eyebrow: "Pricing Radar",
          title: "旗舰款价格雷达",
          latest: "定价核对",
          official: "官方定价"
        }
      : {
          eyebrow: "Pricing Radar",
          title: "Flagship Pricing Radar",
          latest: "Pricing checked",
          official: "Official pricing"
        };

  return (
    <div className="mt-10 rounded-[2rem] border border-slate-200/70 bg-[linear-gradient(180deg,#f8fbff_0%,#f3f6fb_100%)] p-5">
      <div>
        <div className="eyebrow">{copy.eyebrow}</div>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{copy.title}</h3>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {entries.map((entry) => {
          const tone = getRecencyTone(entry.verifiedAt);
          const brandStyle = brandStyles[entry.company] ?? "from-slate-800 to-slate-700";

          return (
            <article
              key={entry.company}
              className="overflow-hidden rounded-[1.9rem] border border-white/80 bg-white/95 shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
            >
              <div className={`bg-gradient-to-r ${brandStyle} px-5 py-4 text-white`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xl font-semibold tracking-tight">{entry.company}</div>
                    <div className="mt-1 text-sm text-white/80">{entry.product}</div>
                  </div>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
                    {entry.basis}
                  </span>
                </div>
              </div>

              <div className="px-5 py-5">
                <div className="text-[2.2rem] font-semibold leading-none tracking-tight text-ink">{entry.headlinePrice}</div>
                {entry.secondaryPrice ? <div className="mt-3 text-lg text-slate-600">{entry.secondaryPrice}</div> : null}

                <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{copy.latest}</div>
                      <div className="mt-4 text-lg font-semibold text-ink">{formatDate(entry.verifiedAt, locale)}</div>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${tone.pill}`}>
                        <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                        {locale === "zh" ? tone.labelZh : tone.labelEn}
                      </span>
                      <a
                        href={entry.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        {copy.official}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
