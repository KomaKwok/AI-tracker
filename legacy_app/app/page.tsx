import { MetricCard } from "@/components/metric-card";
import { EmptyState } from "@/components/empty-state";
import { RefreshButton } from "@/components/refresh-button";
import { SectionHeader } from "@/components/section-header";
import { SignalCard } from "@/components/signal-card";
import { getDictionary } from "@/lib/i18n";
import { getDashboardData, getSourceCoverageSummary, splitByRegion } from "@/lib/radar/repository";
import { formatRelativeDate, withinDays } from "@/lib/utils";

export default async function DashboardPage() {
  const { locale, t } = await getDictionary();
  const data = await getDashboardData();
  const coverage = getSourceCoverageSummary(data.sources);
  const todaySignals = data.signals.filter((signal) => withinDays(signal.publishedAt, 1)).slice(0, 4);
  const weekSignals = data.signals.filter((signal) => withinDays(signal.publishedAt, 7)).slice(0, 6);
  const topSignals = [...data.signals].sort((a, b) => b.signalScore - a.signalScore).slice(0, 4);
  const regional = splitByRegion(data.signals);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="panel overflow-hidden p-6">
          <div className="eyebrow">{t.dashboard.eyebrow}</div>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-ink">
            {t.dashboard.heroTitle}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">{t.dashboard.heroDescription}</p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-600">
            <div className="rounded-full bg-white px-4 py-2">
              {t.dashboard.coverage}: {coverage.active}
            </div>
            <div className="rounded-full bg-white px-4 py-2">
              {t.dashboard.officialMix}: {coverage.official}
            </div>
            <div className="rounded-full bg-white px-4 py-2">
              {t.dashboard.lastRefresh}: {formatRelativeDate(data.lastUpdatedAt, locale)}
            </div>
          </div>
        </div>
        <div className="panel p-6">
          <SectionHeader
            title={t.dashboard.refreshTitle}
            description={t.dashboard.refreshDescription}
            action={<RefreshButton labels={t.refresh} />}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard label={t.dashboard.totalSources} value={`${data.metrics.totalSources}`} detail={t.dashboard.totalSourcesDetail} />
            <MetricCard label={t.dashboard.new24h} value={`${data.metrics.newSignals24h}`} detail={t.dashboard.new24hDetail} />
            <MetricCard label={t.dashboard.new7d} value={`${data.metrics.newSignals7d}`} detail={t.dashboard.new7dDetail} />
            <MetricCard
              label={t.dashboard.lastUpdated}
              value={
                data.lastUpdatedAt
                  ? new Date(data.lastUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : t.common.never
              }
              detail={t.dashboard.lastUpdatedDetail}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-8 xl:grid-cols-[1fr_1fr]">
        <div>
          <SectionHeader title={t.dashboard.todayWeekTitle} description={t.dashboard.todayWeekDescription} />
          <div className="space-y-4">
            {[...todaySignals, ...weekSignals].slice(0, 6).length ? (
              [...todaySignals, ...weekSignals].slice(0, 6).map((signal) => (
                <SignalCard key={signal.id} signal={signal} labels={t.common} locale={locale} />
              ))
            ) : (
              <EmptyState
                title={locale === "zh" ? "暂无今日或本周信号" : "No signals for today or this week"}
                description={
                  locale === "zh"
                    ? "当前还没有抓到最近 7 天内的真实信号。你可以手动刷新，或继续为官方来源实现适配器。"
                    : "There are no verified signals from the last 7 days yet. You can refresh manually or add more official source adapters."
                }
              />
            )}
          </div>
        </div>
        <div className="space-y-8">
          <div>
            <SectionHeader title={t.dashboard.radarTitle} description={t.dashboard.radarDescription} />
            <div className="space-y-4">
              {topSignals.length ? (
                topSignals.map((signal) => (
                  <SignalCard key={signal.id} signal={signal} labels={t.common} locale={locale} />
                ))
              ) : (
                <EmptyState
                  title={locale === "zh" ? "暂无一手雷达信号" : "No first-hand radar signals yet"}
                  description={
                    locale === "zh"
                      ? "系统现在只显示真实抓到的数据。由于大部分官方适配器还没实现，这里可能暂时为空。"
                      : "The app now shows only verified fetched data. Because most official adapters are not implemented yet, this section may be empty for now."
                  }
                />
              )}
            </div>
          </div>
          <div className="panel p-6">
            <SectionHeader title={t.dashboard.trendTitle} description={t.dashboard.trendDescription} />
            {data.trendSummary.last7d.length || data.trendSummary.last30d.length ? (
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{t.dashboard.last7d}</h3>
                  <div className="mt-4 space-y-4">
                    {data.trendSummary.last7d.map((trend) => (
                      <div key={trend.label} className="rounded-2xl bg-slate-50 p-4">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-ink">{trend.label}</div>
                          <div className="text-sm text-slate-500">{trend.count} signals</div>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{trend.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{t.dashboard.last30d}</h3>
                  <div className="mt-4 space-y-4">
                    {data.trendSummary.last30d.map((trend) => (
                      <div key={trend.label} className="rounded-2xl bg-slate-50 p-4">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-ink">{trend.label}</div>
                          <div className="text-sm text-slate-500">{trend.count} signals</div>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{trend.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                title={locale === "zh" ? "暂无趋势可总结" : "No trends to summarize yet"}
                description={
                  locale === "zh"
                    ? "趋势总结依赖最近抓到的真实信号。当前数据不足，所以这里保持为空。"
                    : "Trend summaries depend on recently fetched verified signals. There is not enough live data yet, so this section stays empty."
                }
              />
            )}
          </div>
          <div className="panel p-6">
            <SectionHeader
              title={t.dashboard.chinaVsGlobalTitle}
              description={t.dashboard.chinaVsGlobalDescription}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-sky-50 p-4">
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">{t.dashboard.global}</div>
                <div className="mt-2 text-3xl font-semibold text-ink">{regional.global.length}</div>
                <p className="mt-2 text-sm text-slate-600">{t.dashboard.globalDescription}</p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-4">
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">{t.dashboard.china}</div>
                <div className="mt-2 text-3xl font-semibold text-ink">{regional.china.length}</div>
                <p className="mt-2 text-sm text-slate-600">{t.dashboard.chinaDescription}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-600">{data.trendSummary.chinaVsGlobal}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
