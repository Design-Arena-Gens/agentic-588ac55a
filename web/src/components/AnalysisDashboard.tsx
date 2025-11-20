"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  ArticleAnalysis,
  CurrencyImpact,
  DashboardSummary,
} from "@/lib/economyAnalyzer";

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: DashboardSummary };

const CONFIDENCE_WEIGHT: Record<CurrencyImpact["confidence"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const DIRECTION_LABELS: Record<CurrencyImpact["direction"], string> = {
  bullish: "Bullish pressure expected",
  bearish: "Bearish pressure expected",
  neutral: "Outlook uncertain",
};

const DIRECTION_STYLES: Record<
  CurrencyImpact["direction"],
  string
> = {
  bullish:
    "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  bearish:
    "border-rose-600/20 bg-rose-500/10 text-rose-700 dark:text-rose-200",
  neutral:
    "border-slate-600/20 bg-slate-500/10 text-slate-700 dark:text-slate-200",
};

interface AggregatedImpact {
  economyId: string;
  economyName: string;
  currency: string;
  averageScore: number;
  direction: CurrencyImpact["direction"];
  articles: number;
  bullish: number;
  bearish: number;
  neutral: number;
  majorPairs: string[];
}

const aggregateImpacts = (analyses: ArticleAnalysis[]): AggregatedImpact[] => {
  const accumulator = new Map<
    string,
    Omit<AggregatedImpact, "averageScore" | "direction"> & { scores: number[] }
  >();

  analyses.forEach((analysis) => {
    analysis.impacts.forEach((impact) => {
      if (!accumulator.has(impact.currency)) {
        accumulator.set(impact.currency, {
          economyId: impact.economyId,
          economyName: impact.economyName,
          currency: impact.currency,
          articles: 0,
          bullish: 0,
          bearish: 0,
          neutral: 0,
          majorPairs: impact.majorPairs,
          scores: [],
        });
      }

      const record = accumulator.get(impact.currency);
      if (!record) return;

      record.articles += 1;
      record.scores.push(impact.score * CONFIDENCE_WEIGHT[impact.confidence]);
      record.bullish += impact.direction === "bullish" ? 1 : 0;
      record.bearish += impact.direction === "bearish" ? 1 : 0;
      record.neutral += impact.direction === "neutral" ? 1 : 0;
    });
  });

  return Array.from(accumulator.values())
    .map(({ scores, ...rest }) => {
      const averageScore =
        scores.length === 0
          ? 0
          : Number(
              (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2),
            );

      const breakdown = [
        { direction: "bullish" as const, count: rest.bullish },
        { direction: "bearish" as const, count: rest.bearish },
        { direction: "neutral" as const, count: rest.neutral },
      ].sort((a, b) => b.count - a.count);

      let direction: CurrencyImpact["direction"] = "neutral";
      if (breakdown[0].count > breakdown[1].count) {
        direction = breakdown[0].direction;
      } else if (averageScore > 0.3) {
        direction = "bullish";
      } else if (averageScore < -0.3) {
        direction = "bearish";
      }

      return {
        ...rest,
        averageScore,
        direction,
      };
    })
    .sort((a, b) => Math.abs(b.averageScore) - Math.abs(a.averageScore));
};

const formatTimestamp = (value: string) => {
  try {
    const dt = new Date(value);
    return dt.toLocaleString(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
};

const formatPublishedAt = (value: string | null) => {
  if (!value) return "Unknown";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const ImpactBadge = ({ impact }: { impact: CurrencyImpact }) => (
  <div
    className={clsx(
      "rounded-lg border px-3 py-2 text-sm transition-colors",
      DIRECTION_STYLES[impact.direction],
    )}
  >
    <div className="font-semibold">
      {impact.currency} · {impact.economyName}
    </div>
    <div className="mt-1 text-xs opacity-80">{DIRECTION_LABELS[impact.direction]}</div>
    <div className="mt-2 text-xs font-medium text-white/80">
      Score {impact.score} · Confidence {impact.confidence.toUpperCase()}
    </div>
    <div className="mt-2 text-xs">
      Pairs:{" "}
      {impact.majorPairs.map((pair) => (
        <span
          key={pair}
          className="mr-2 inline-flex rounded-full border border-white/20 px-2 py-0.5"
        >
          {pair}
        </span>
      ))}
    </div>
  </div>
);

const ArticleCard = ({ analysis }: { analysis: ArticleAnalysis }) => (
  <article className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-slate-700/60 dark:bg-slate-900">
    <header className="flex flex-col gap-1">
      <a
        href={analysis.article.link}
        target="_blank"
        rel="noopener noreferrer"
        className="text-lg font-semibold text-slate-900 underline decoration-slate-300 decoration-2 underline-offset-4 transition hover:decoration-primary dark:text-white"
      >
        {analysis.article.title}
      </a>
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {analysis.article.sourceName} ·{" "}
        {formatPublishedAt(analysis.article.publishedAt)}
      </div>
    </header>
    <p className="mt-4 text-sm leading-6 text-slate-700 dark:text-slate-200">
      {analysis.summary}
    </p>
    {analysis.impacts.length > 0 ? (
      <>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {analysis.impacts.map((impact) => (
            <ImpactBadge key={impact.currency + impact.economyId} impact={impact} />
          ))}
        </div>
        <ul className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
          {analysis.impacts.map((impact, idx) => (
            <li key={`${impact.currency}-${idx}`} className="leading-5">
              <span className="font-semibold text-slate-600 dark:text-slate-200">
                {impact.currency} outlook:
              </span>{" "}
              {impact.supportingReasons.join(" • ")}
            </li>
          ))}
        </ul>
      </>
    ) : (
      <div className="mt-6 rounded-xl border border-slate-500/30 bg-slate-500/10 p-4 text-sm text-slate-500 dark:text-slate-300">
        No direct currency impact detected. Monitor for follow-up releases or
        central bank commentary.
      </div>
    )}
  </article>
);

const ToplineSummary = ({
  aggregated,
}: {
  aggregated: AggregatedImpact[];
}) => (
  <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {aggregated.map((item) => (
      <div
        key={item.currency}
        className={clsx(
          "rounded-2xl border p-5 transition-all hover:-translate-y-1 hover:shadow-md",
          item.direction === "bullish"
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100"
            : item.direction === "bearish"
              ? "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-100"
              : "border-slate-500/40 bg-slate-500/10 text-slate-800 dark:text-slate-100",
        )}
      >
        <div className="text-sm font-semibold uppercase tracking-wide opacity-70">
          {item.economyName}
        </div>
        <div className="mt-2 text-3xl font-bold">{item.currency}</div>
        <div className="mt-2 text-sm font-medium uppercase tracking-wide">
          {item.direction.toUpperCase()}
        </div>
        <div className="mt-3 text-xs opacity-80">
          Avg score {item.averageScore} · Signals {item.articles}
        </div>
        <div className="mt-4 text-xs">
          Focus pairs:{" "}
          {item.majorPairs.map((pair) => (
            <span key={pair} className="mr-2 inline-flex rounded-full border border-white/30 px-2 py-0.5">
              {pair}
            </span>
          ))}
        </div>
      </div>
    ))}
  </section>
);

export const AnalysisDashboard = () => {
  const [state, setState] = useState<FetchState>({ status: "idle" });
  const [refreshKey, setRefreshKey] = useState(0);

  const loadData = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const response = await fetch(`/api/analyze?refresh=${Date.now()}`, {
        next: { revalidate: 0 },
      });
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }
      const payload: DashboardSummary = await response.json();
      setState({ status: "success", data: payload });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load analysis at this time.",
      });
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  const aggregated = useMemo(() => {
    if (state.status !== "success") return [];
    return aggregateImpacts(state.data.analyses);
  }, [state]);

  const handleManualRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Global FX Intelligence Monitor
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Aggregates top-tier financial news to highlight currency impacts,
              sentiment and tradable pair opportunities.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleManualRefresh}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              Refresh Analysis
            </button>
          </div>
        </div>
        {state.status === "success" && (
          <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Last updated {formatTimestamp(state.data.updatedAt)}
          </div>
        )}
      </header>

      {state.status === "loading" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          Updating macro intelligence…
        </div>
      )}

      {state.status === "error" && (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-8 text-center text-rose-700 dark:text-rose-200">
          {state.message}
        </div>
      )}

      {state.status === "success" && state.data.analyses.length === 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          No relevant news detected from the selected sources. Try refreshing in a
          few minutes.
        </div>
      )}

      {state.status === "success" && aggregated.length > 0 && (
        <ToplineSummary aggregated={aggregated} />
      )}

      {state.status === "success" && state.data.analyses.length > 0 && (
        <section className="grid gap-6">
          {state.data.analyses.map((analysis) => (
            <ArticleCard
              key={analysis.article.link}
              analysis={analysis}
            />
          ))}
        </section>
      )}
    </div>
  );
};
