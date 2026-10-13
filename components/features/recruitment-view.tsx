"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightIcon,
  BriefcaseIcon,
  ChevronDownIcon,
  MoreHorizontalIcon,
  PhoneIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UserPlusIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  ErrorBanner,
  Pill,
  apiError,
  labelize,
  selectClass,
} from "@/components/shared/ui-bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Job = {
  id: string;
  title: string;
  departmentName: string | null;
  location: string | null;
  employmentType: string;
  openings: number;
  status: "open" | "closed";
  candidateCount: number;
};

type Candidate = {
  id: string;
  jobId: string;
  name: string;
  email: string;
  phone: string | null;
  stage: string;
  notes: string | null;
};

type Department = { id: string; name: string };

const STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"] as const;
const STAGE_DOT: Record<string, string> = {
  applied: "bg-slate-400",
  screening: "bg-sky-500",
  interview: "bg-violet-500",
  offer: "bg-amber-500",
  hired: "bg-emerald-500",
  rejected: "bg-rose-500",
};

const STAGE_TINT: Record<string, string> = {
  applied: "bg-slate-100 text-slate-600",
  screening: "bg-sky-100 text-sky-700",
  interview: "bg-violet-100 text-violet-700",
  offer: "bg-amber-100 text-amber-700",
  hired: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
};

// One-click forward step for each stage (hired/rejected are end states).
// Candidates shown per stage before "Show more".
const PREVIEW_COUNT = 2;

const NEXT_STAGE: Record<string, string | undefined> = {
  applied: "screening",
  screening: "interview",
  interview: "offer",
  offer: "hired",
};

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

export function RecruitmentView() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string>("all");

  const [jobForm, setJobForm] = useState(false);
  const [job, setJob] = useState({
    title: "",
    departmentId: "",
    location: "",
    employmentType: "full_time",
    openings: "1",
    description: "",
  });

  const [candForm, setCandForm] = useState(false);
  const [cand, setCand] = useState({ jobId: "", name: "", email: "", phone: "", notes: "" });

  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Job | null>(null);
  const [candToDelete, setCandToDelete] = useState<Candidate | null>(null);

  async function load() {
    try {
      setError("");
      const [j, c, d] = await Promise.all([
        fetch("/api/jobs"),
        fetch("/api/candidates"),
        fetch("/api/departments"),
      ]);

      if (!j.ok) throw new Error(await apiError(j, "Failed to load recruitment data"));
      if (!c.ok) throw new Error(await apiError(c, "Failed to load candidates"));

      setJobs(await j.json());
      setCandidates(await c.json());
      if (d.ok) setDepartments(await d.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recruitment data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(
    () => (selected === "all" ? candidates : candidates.filter((c) => c.jobId === selected)),
    [candidates, selected],
  );

  // Search narrows the columns; the funnel summary keeps showing the whole job.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? visible.filter((c) => `${c.name} ${c.email} ${c.phone ?? ""}`.toLowerCase().includes(q))
      : visible;
  }, [visible, query]);

  const jobTitle = (id: string) => jobs.find((j) => j.id === id)?.title ?? "";

  async function post(url: string, body: object, ok: string, done: () => void) {
    setSaving(true);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(await apiError(res, "Request failed"));

      toast.success(ok);
      done();
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  async function patch(url: string, body: object) {
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        toast.error(await apiError(res, "Update failed"));
      }
    } catch {
      toast.error("Update failed. Check your connection and try again.");
    }

    load();
  }

  // Move a candidate right away so the dropdown does not snap back while the
  // request is in flight; load() then confirms (or reverts) from the server.
  function moveCandidate(candidate: Candidate, stage: string) {
    setCandidates((current) =>
      current.map((c) => (c.id === candidate.id ? { ...c, stage } : c)),
    );
    patch(`/api/candidates/${candidate.id}`, { stage });
  }

  async function removeJob() {
    if (!toDelete) return;

    const res = await fetch(`/api/jobs/${toDelete.id}`, { method: "DELETE" });

    if (!res.ok) {
      toast.error(await apiError(res, "Failed to delete"));
    } else {
      toast.success("Job opening deleted");
      if (selected === toDelete.id) setSelected("all");
      load();
    }

    setToDelete(null);
  }

  async function removeCandidate() {
    if (!candToDelete) return;

    const res = await fetch(`/api/candidates/${candToDelete.id}`, { method: "DELETE" });

    if (!res.ok) {
      toast.error(await apiError(res, "Failed to delete candidate"));
    } else {
      toast.success("Candidate deleted");
      load();
    }

    setCandToDelete(null);
  }

  const openJobs = jobs.filter((j) => j.status === "open");

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Recruitment"
        description="Track job openings and move candidates through the hiring pipeline."
        action={
          <>
            <Button
              variant="outline"
              disabled={openJobs.length === 0}
              onClick={() => {
                setCand({ jobId: selected !== "all" ? selected : openJobs[0].id, name: "", email: "", phone: "", notes: "" });
                setCandForm(true);
              }}
            >
              <UserPlusIcon /> Add Candidate
            </Button>
            <Button onClick={() => setJobForm(true)}>
              <PlusIcon /> New Opening
            </Button>
          </>
        }
      />

      <ErrorBanner message={error} />

      {loading ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={BriefcaseIcon}
          title="No job openings yet"
          description="Create an opening, then add candidates and move them through the pipeline."
        />
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((j) => (
              <Card
                key={j.id}
                role="button"
                tabIndex={0}
                aria-pressed={selected === j.id}
                className={`cursor-pointer gap-3 p-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected === j.id ? "ring-2 ring-primary" : "hover:ring-primary/40"}`}
                onClick={() => setSelected(selected === j.id ? "all" : j.id)}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    setSelected(selected === j.id ? "all" : j.id);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{j.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[j.departmentName, j.location, labelize(j.employmentType)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Pill tone={j.status === "open" ? "green" : "gray"}>{labelize(j.status)}</Pill>
                </div>

                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {j.openings} {j.openings === 1 ? "position" : "positions"} · {j.candidateCount} candidates
                  </span>
                  <span className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => patch(`/api/jobs/${j.id}`, { status: j.status === "open" ? "closed" : "open" })}
                    >
                      {j.status === "open" ? "Close" : "Reopen"}
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Delete ${j.title}`} className="text-muted-foreground hover:text-destructive" onClick={() => setToDelete(j)}>
                      <Trash2Icon />
                    </Button>
                  </span>
                </div>
              </Card>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Hiring pipeline{selected !== "all" && ` · ${jobTitle(selected)}`}
              </h2>
              <p className="text-xs text-muted-foreground">
                Drag a candidate to another column, or use the buttons on the card.
                {selected !== "all" && (
                  <>
                    {" "}
                    <button type="button" className="font-medium text-primary hover:underline" onClick={() => setSelected("all")}>
                      Show all jobs
                    </button>
                  </>
                )}
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search candidates"
                placeholder="Search candidates…"
                className="pl-8"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Funnel summary */}
          <div className="mb-5 overflow-hidden rounded-2xl border bg-card p-4 shadow-sm">
            <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-muted">
              {STAGES.map((stage) => {
                const count = visible.filter((c) => c.stage === stage).length;
                return count === 0 ? null : (
                  <div
                    key={stage}
                    className={`${STAGE_DOT[stage]} transition-all`}
                    style={{ width: `${(count / Math.max(visible.length, 1)) * 100}%` }}
                    title={`${labelize(stage)}: ${count}`}
                  />
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {STAGES.map((stage) => (
                <div key={stage} className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={`size-2 rounded-full ${STAGE_DOT[stage]}`} />
                    {labelize(stage)}
                  </p>
                  <p className="text-xl font-semibold tabular-nums">
                    {visible.filter((c) => c.stage === stage).length}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-4 overflow-x-auto pb-3">
            {STAGES.map((stage) => {
              const list = shown.filter((c) => c.stage === stage);
              const next = NEXT_STAGE[stage];
              const isCollapsed = !!collapsed[stage];
              const isExpanded = !!expanded[stage];
              const visibleList = isCollapsed ? [] : isExpanded ? list : list.slice(0, PREVIEW_COUNT);
              const hiddenCount = isCollapsed ? 0 : list.length - visibleList.length;
              const isOver = overStage === stage && dragId !== null;

              return (
                <section
                  key={stage}
                  aria-label={`${labelize(stage)} candidates`}
                  onDragOver={(e) => {
                    if (!dragId) return;
                    e.preventDefault();
                    setOverStage(stage);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStage(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const dragged = candidates.find((c) => c.id === dragId);
                    if (dragged && dragged.stage !== stage) moveCandidate(dragged, stage);
                    setDragId(null);
                    setOverStage(null);
                  }}
                  className={`flex min-w-64 flex-1 flex-col rounded-2xl bg-muted/40 transition ${isOver ? "bg-primary/5 ring-2 ring-primary/40" : ""}`}
                >
                  <div className={`mx-3 mt-0 h-1 rounded-b-full ${STAGE_DOT[stage]}`} />

                  <button
                    type="button"
                    aria-expanded={!isCollapsed}
                    aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${labelize(stage)}`}
                    onClick={() => setCollapsed({ ...collapsed, [stage]: !isCollapsed })}
                    className="flex w-full items-center justify-between px-4 pb-1 pt-3 text-left"
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      <ChevronDownIcon className={`size-4 text-muted-foreground transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                      {labelize(stage)}
                    </span>
                    <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground shadow-sm">
                      {list.length}
                    </span>
                  </button>

                  <div className="flex flex-1 flex-col gap-3 p-3 pt-2">
                    {visibleList.map((c) => (
                      <article
                        key={c.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", c.id);
                          setDragId(c.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverStage(null);
                        }}
                        className={`group cursor-grab space-y-3 rounded-xl bg-card p-3.5 shadow-sm ring-1 ring-foreground/5 transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing ${dragId === c.id ? "opacity-40" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${STAGE_TINT[stage]}`}
                          >
                            {initialsOf(c.name)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold leading-tight">{c.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label={`Actions for ${c.name}`}
                                  className="-mr-1.5 -mt-1 text-muted-foreground opacity-60 group-hover:opacity-100"
                                />
                              }
                            >
                              <MoreHorizontalIcon />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuGroup>
                                <DropdownMenuLabel>Move to</DropdownMenuLabel>
                                {STAGES.filter((st) => st !== c.stage).map((st) => (
                                  <DropdownMenuItem key={st} onClick={() => moveCandidate(c, st)}>
                                    <span className={`size-2 rounded-full ${STAGE_DOT[st]}`} />
                                    {labelize(st)}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuGroup>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => setCandToDelete(c)}>
                                <Trash2Icon />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {(selected === "all" || c.phone) && (
                          <div className="flex flex-wrap gap-1.5">
                            {selected === "all" && (
                              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                                <BriefcaseIcon className="size-3 shrink-0" />
                                <span className="truncate">{jobTitle(c.jobId)}</span>
                              </span>
                            )}
                            {c.phone && (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                                <PhoneIcon className="size-3 shrink-0" />
                                {c.phone}
                              </span>
                            )}
                          </div>
                        )}

                        {next && (
                          <button
                            type="button"
                            onClick={() => moveCandidate(c, next)}
                            className="flex w-full items-center justify-between rounded-lg border border-dashed px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary hover:bg-primary/5 hover:text-primary"
                          >
                            Move to {labelize(next)}
                            <ArrowRightIcon className="size-3.5" />
                          </button>
                        )}
                      </article>
                    ))}

                    {!isCollapsed && list.length > PREVIEW_COUNT && (
                      <button
                        type="button"
                        onClick={() => setExpanded({ ...expanded, [stage]: !isExpanded })}
                        className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-background hover:text-foreground"
                      >
                        <ChevronDownIcon className={`size-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        {isExpanded ? "Show less" : `Show ${hiddenCount} more`}
                      </button>
                    )}

                    {!isCollapsed && list.length === 0 && (
                      <div className="rounded-xl border-2 border-dashed py-10 text-center text-xs text-muted-foreground">
                        {query ? "No matches" : isOver ? "Drop here" : "No candidates"}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}

      <Dialog open={jobForm} onOpenChange={setJobForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Job Opening</DialogTitle>
            <DialogDescription>Describe the role you are hiring for.</DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              post(
                "/api/jobs",
                {
                  title: job.title,
                  departmentId: job.departmentId || null,
                  location: job.location || null,
                  employmentType: job.employmentType,
                  openings: Number(job.openings) || 1,
                  description: job.description || null,
                },
                "Job opening created",
                () => {
                  setJobForm(false);
                  setJob({ ...job, title: "", location: "", description: "" });
                },
              );
            }}
          >
            <div>
              <Label htmlFor="job-title" className="mb-1.5">Title</Label>
              <Input id="job-title" required value={job.title} onChange={(e) => setJob({ ...job, title: e.target.value })} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="job-dept" className="mb-1.5">Department</Label>
                <select id="job-dept" className={selectClass} value={job.departmentId} onChange={(e) => setJob({ ...job, departmentId: e.target.value })}>
                  <option value="">None</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="job-type" className="mb-1.5">Type</Label>
                <select id="job-type" className={selectClass} value={job.employmentType} onChange={(e) => setJob({ ...job, employmentType: e.target.value })}>
                  {["full_time", "part_time", "contract", "intern"].map((t) => (
                    <option key={t} value={t}>{labelize(t)}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="job-location" className="mb-1.5">Location</Label>
                <Input id="job-location" value={job.location} onChange={(e) => setJob({ ...job, location: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="job-openings" className="mb-1.5">Positions</Label>
                <Input id="job-openings" type="number" min="1" value={job.openings} onChange={(e) => setJob({ ...job, openings: e.target.value })} />
              </div>
            </div>

            <div>
              <Label htmlFor="job-desc" className="mb-1.5">Description</Label>
              <Textarea id="job-desc" rows={3} value={job.description} onChange={(e) => setJob({ ...job, description: e.target.value })} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setJobForm(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create opening"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={candForm} onOpenChange={setCandForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Candidate</DialogTitle>
            <DialogDescription>They start in the Applied column.</DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              post(
                "/api/candidates",
                {
                  jobId: cand.jobId,
                  name: cand.name,
                  email: cand.email,
                  phone: cand.phone || null,
                  notes: cand.notes || null,
                },
                "Candidate added",
                () => setCandForm(false),
              );
            }}
          >
            <div>
              <Label htmlFor="cand-job" className="mb-1.5">Job opening</Label>
              <select id="cand-job" className={selectClass} value={cand.jobId} onChange={(e) => setCand({ ...cand, jobId: e.target.value })}>
                {openJobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="cand-name" className="mb-1.5">Name</Label>
                <Input id="cand-name" required value={cand.name} onChange={(e) => setCand({ ...cand, name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="cand-phone" className="mb-1.5">Phone</Label>
                <Input id="cand-phone" value={cand.phone} onChange={(e) => setCand({ ...cand, phone: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="cand-email" className="mb-1.5">Email</Label>
              <Input id="cand-email" type="email" required value={cand.email} onChange={(e) => setCand({ ...cand, email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="cand-notes" className="mb-1.5">Notes</Label>
              <Textarea id="cand-notes" rows={2} value={cand.notes} onChange={(e) => setCand({ ...cand, notes: e.target.value })} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCandForm(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Adding…" : "Add candidate"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!candToDelete}
        onOpenChange={(o) => !o && setCandToDelete(null)}
        title="Delete candidate?"
        description={candToDelete ? `${candToDelete.name} will be removed from the pipeline.` : undefined}
        confirmLabel="Delete"
        onConfirm={removeCandidate}
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete job opening?"
        description={toDelete ? `"${toDelete.title}" and its ${toDelete.candidateCount} candidates will be removed.` : undefined}
        confirmLabel="Delete"
        onConfirm={removeJob}
      />
    </div>
  );
}
