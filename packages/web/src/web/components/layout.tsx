import { Link, useLocation } from "wouter";
import { BookOpen, CalendarDays, PlusCircle, Radar, Settings2 } from "lucide-react";
import { cn } from "../lib/utils";
import { useStats } from "../queries/events";
import { ThemeSwitch } from "./theme-switch";

const NAV = [
  { to: "/", label: "Today", icon: Radar },
  { to: "/feed", label: "Feed", icon: CalendarDays },
  { to: "/submit", label: "Add event", icon: PlusCircle },
  { to: "/admin", label: "Admin", icon: Settings2 },
  { to: "/manual", label: "Manual", icon: BookOpen },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const stats = useStats();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src="/images/logo-mark.png"
              alt="Nashville Campus Radar"
              width={36}
              height={36}
              className="size-9 rounded-xl"
            />
            <span className="font-display text-lg font-extrabold">
              Nashville Campus Radar
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = location === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
                    active ? "bg-ink text-white" : "text-ink-soft hover:bg-line/60 hover:text-ink",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto hidden items-center gap-5 text-xs text-ink-soft lg:flex">
            <span className="tnum">
              <strong className="text-ink">{stats.data?.events ?? "—"}</strong> events indexed
            </span>
            <span className="tnum">
              <strong className="text-tomato">{stats.data?.confirmed ?? "—"}</strong> confirmed food
            </span>
            <span className="tnum">
              <strong className="text-ink">
                {stats.data ? `${stats.data.sources.healthy}/${stats.data.sources.total}` : "—"}
              </strong>{" "}
              sources healthy
            </span>
          </div>

          <div className="ml-auto lg:ml-4">
            <ThemeSwitch />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-6 py-8">{children}</main>

      <footer className="mx-auto max-w-[1180px] px-6 pb-10 pt-4 text-xs text-ink-soft">
        Every event here was scraped from a public calendar and classified by a language model.
        Food claims show a confidence score and link to the original page — nothing is invented.
      </footer>
    </div>
  );
}
