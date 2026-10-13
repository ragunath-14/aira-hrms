"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LayoutGridIcon, SearchIcon, UserIcon } from "lucide-react";

type Page = { href: string; label: string };
type Person = {
  id: string;
  name: string;
  email: string;
  department: string | null;
  designation: string | null;
};

// Header search for My Workspace: jump to a section, or look up a coworker.
export function WorkspaceSearch({ pages }: { pages: Page[] }) {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const q = query.trim();
  const matchedPages = q
    ? pages.filter((p) => p.label.toLowerCase().includes(q.toLowerCase())).slice(0, 5)
    : [];

  useEffect(() => {
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPeople([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/employee/directory?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          if (!cancelled) setPeople(Array.isArray(data) ? data : []);
        })
        .catch(() => {});
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const hasResults = matchedPages.length > 0 || people.length > 0;

  return (
    <div ref={boxRef} className="relative w-full">
      <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        aria-label="Search the workspace"
        placeholder="Search directory, policies, payslips, or coworkers…"
        className="h-10 w-full rounded-full border border-input bg-muted/50 pl-10 pr-4 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/40"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      />

      {open && q.length >= 1 && (
        <div className="absolute left-0 right-0 top-12 z-40 max-h-96 overflow-y-auto rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg">
          {!hasResults ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              {q.length < 2 ? "Keep typing…" : "No matches"}
            </p>
          ) : (
            <>
              {matchedPages.length > 0 && (
                <div>
                  <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Sections
                  </p>
                  {matchedPages.map((p) => (
                    <Link
                      key={p.href}
                      href={p.href}
                      onClick={() => {
                        setOpen(false);
                        setQuery("");
                      }}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-muted"
                    >
                      <LayoutGridIcon className="size-4 text-muted-foreground" />
                      {p.label}
                    </Link>
                  ))}
                </div>
              )}

              {people.length > 0 && (
                <div className={matchedPages.length > 0 ? "mt-1 border-t pt-1" : ""}>
                  <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Coworkers
                  </p>
                  {people.map((p) => (
                    <a
                      key={p.id}
                      href={`mailto:${p.email}`}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        <UserIcon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{p.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[p.designation, p.department].filter(Boolean).join(" · ") || p.email}
                        </span>
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
