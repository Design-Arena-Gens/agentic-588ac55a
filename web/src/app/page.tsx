import { AnalysisDashboard } from "@/components/AnalysisDashboard";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-12 text-slate-100">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 lg:px-10">
        <AnalysisDashboard />
      </main>
    </div>
  );
}
