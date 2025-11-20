import Parser from "rss-parser";
import { NextResponse } from "next/server";
import {
  NEWS_SOURCES,
  RawArticle,
  transformArticle,
  buildDashboardSummary,
} from "@/lib/economyAnalyzer";

const parser = new Parser({
  timeout: 10000,
});

export const revalidate = 0;

export async function GET() {
  try {
    const feeds = await Promise.all(
      NEWS_SOURCES.map(async (source) => {
        const feed = await parser.parseURL(source.url);
        return (feed.items ?? [])
          .slice(0, 8)
          .map((item) => transformArticle(source, item as RawArticle));
      }),
    );

    const articles = feeds.flat().sort((a, b) => {
      const timeA = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const timeB = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return timeB - timeA;
    });

    const summary = buildDashboardSummary(articles.slice(0, 24));

    return NextResponse.json(summary, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to analyze latest news.",
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : { message: "Unknown error" },
      },
      { status: 502 },
    );
  }
}

