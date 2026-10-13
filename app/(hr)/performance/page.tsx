"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, PlusIcon, TargetIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import {
  DataTablePagination,
  paginate,
} from "@/components/shared/data-table-pagination";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteButton } from "@/components/shared/delete-button";
import { useIsHr } from "@/hooks/use-is-hr";
import { selectClass } from "@/components/shared/ui-bits";
import { errorText } from "@/lib/format/error-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PerformanceReview = {
  id: string;
  employeeId: string;
  reviewPeriod: string;
  rating: number | null;
  comments: string | null;
  status: string;
};

type PerformanceGoal = {
  id: string;
  employeeId: string;
  title: string;
  description: string | null;
  status: string;
};

type Employee = {
  id: string;
  firstName: string;
  lastName: string | null;
};

const PAGE_SIZE = 10;

export default function PerformancePage() {
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [goals, setGoals] = useState<PerformanceGoal[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [goalsPage, setGoalsPage] = useState(1);

  const isHr = useIsHr();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [review, setReview] = useState({ employeeId: "", reviewPeriod: "", rating: "", comments: "" });
  const [goal, setGoal] = useState({ employeeId: "", title: "", description: "" });

  async function submit(url: string, body: object, success: string, done: () => void) {
    setSaving(true);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(errorText(data.error, "Request failed"));

      toast.success(success);
      done();
      loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  async function loadAll() {
      try {
        const [reviewsResponse, goalsResponse, employeesResponse] =
          await Promise.all([
            fetch("/api/performance"),
            fetch("/api/performance/goals"),
            fetch("/api/employees"),
          ]);

        if (reviewsResponse.ok) {
          const data = await reviewsResponse.json();
          setReviews(Array.isArray(data) ? data : []);
        }

        if (goalsResponse.ok) {
          const data = await goalsResponse.json();
          setGoals(Array.isArray(data) ? data : []);
        }

        if (employeesResponse.ok) {
          const data = await employeesResponse.json();
          setEmployees(Array.isArray(data) ? data : []);
        }
      } finally {
        setLoading(false);
      }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const employeeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const employee of employees) {
      map.set(
        employee.id,
        `${employee.firstName}${employee.lastName ? " " + employee.lastName : ""}`,
      );
    }
    return map;
  }, [employees]);

  const pagedReviews = useMemo(
    () => paginate(reviews, reviewsPage, PAGE_SIZE),
    [reviews, reviewsPage],
  );

  const pagedGoals = useMemo(
    () => paginate(goals, goalsPage, PAGE_SIZE),
    [goals, goalsPage],
  );

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Performance"
        description="Employee goals, reviews, ratings and manager comments."
        action={
          <>
            <Button
              variant="outline"
              disabled={employees.length === 0}
              onClick={() => {
                setGoal({ employeeId: employees[0]?.id ?? "", title: "", description: "" });
                setGoalOpen(true);
              }}
            >
              <TargetIcon /> Add goal
            </Button>
            {isHr && (
              <Button
                disabled={employees.length === 0}
                onClick={() => {
                  setReview({ employeeId: employees[0]?.id ?? "", reviewPeriod: "", rating: "", comments: "" });
                  setReviewOpen(true);
                }}
              >
                <PlusIcon /> Add review
              </Button>
            )}
          </>
        }
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue="reviews">
          <TabsList>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="goals">Goals</TabsTrigger>
          </TabsList>

          <TabsContent value="reviews" className="mt-4">
            {reviews.length === 0 ? (
              <Card className="p-0">
                <EmptyState
                  icon={ClipboardList}
                  title="No performance reviews"
                  description="Performance reviews will appear here when they are created."
                />
              </Card>
            ) : (
              <Card className="overflow-hidden p-0">
                <CardHeader className="border-b px-6 py-5">
                  <CardTitle>Performance Reviews</CardTitle>
                </CardHeader>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Review Period</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Comments</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {pagedReviews.map((review) => (
                      <TableRow key={review.id}>
                        <TableCell className="font-medium text-foreground">
                          {employeeNameById.get(review.employeeId) ??
                            review.employeeId}
                        </TableCell>

                        <TableCell className="text-muted-foreground">
                          {review.reviewPeriod}
                        </TableCell>

                        <TableCell className="text-muted-foreground">
                          {review.rating !== null
                            ? `${review.rating}/5`
                            : "Not rated"}
                        </TableCell>

                        <TableCell className="max-w-md text-muted-foreground">
                          {review.comments || "No comments"}
                        </TableCell>

                        <TableCell>
                          <StatusBadge status={review.status} />
                        </TableCell>

                        <TableCell className="text-right">
                          <DeleteButton
                            url={`/api/performance?id=${review.id}`}
                            itemName="review"
                            onDeleted={loadAll}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <DataTablePagination
                  page={reviewsPage}
                  pageSize={PAGE_SIZE}
                  total={reviews.length}
                  onPageChange={setReviewsPage}
                />
              </Card>
            )}
          </TabsContent>

          <TabsContent value="goals" className="mt-4">
            {goals.length === 0 ? (
              <Card className="p-0">
                <EmptyState
                  icon={TargetIcon}
                  title="No performance goals"
                  description="Goals assigned to employees will appear here."
                />
              </Card>
            ) : (
              <Card className="overflow-hidden p-0">
                <CardHeader className="border-b px-6 py-5">
                  <CardTitle>Performance Goals</CardTitle>
                </CardHeader>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Goal</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {pagedGoals.map((goal) => (
                      <TableRow key={goal.id}>
                        <TableCell className="font-medium text-foreground">
                          {employeeNameById.get(goal.employeeId) ??
                            goal.employeeId}
                        </TableCell>

                        <TableCell className="text-foreground">
                          {goal.title}
                        </TableCell>

                        <TableCell className="max-w-md text-muted-foreground">
                          {goal.description || "No description"}
                        </TableCell>

                        <TableCell>
                          <StatusBadge status={goal.status} />
                        </TableCell>

                        <TableCell className="text-right">
                          <DeleteButton
                            url={`/api/performance/goals?id=${goal.id}`}
                            itemName={goal.title}
                            onDeleted={loadAll}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <DataTablePagination
                  page={goalsPage}
                  pageSize={PAGE_SIZE}
                  total={goals.length}
                  onPageChange={setGoalsPage}
                />
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add review</DialogTitle>
            <DialogDescription>Record a performance review for an employee.</DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit(
                "/api/performance",
                {
                  employeeId: review.employeeId,
                  reviewPeriod: review.reviewPeriod,
                  rating: review.rating ? Number(review.rating) : null,
                  comments: review.comments || null,
                  status: "completed",
                },
                "Review added",
                () => setReviewOpen(false),
              );
            }}
          >
            <div>
              <Label htmlFor="rev-emp" className="mb-1.5">Employee</Label>
              <select id="rev-emp" required className={selectClass} value={review.employeeId} onChange={(e) => setReview({ ...review, employeeId: e.target.value })}>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.firstName}{emp.lastName ? ` ${emp.lastName}` : ""}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="rev-period" className="mb-1.5">Review period</Label>
                <Input id="rev-period" required maxLength={40} placeholder="e.g. 2026 H1" value={review.reviewPeriod} onChange={(e) => setReview({ ...review, reviewPeriod: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="rev-rating" className="mb-1.5">Rating (1 to 5)</Label>
                <select id="rev-rating" className={selectClass} value={review.rating} onChange={(e) => setReview({ ...review, rating: e.target.value })}>
                  <option value="">Not rated</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="rev-comments" className="mb-1.5">Comments</Label>
              <Textarea id="rev-comments" rows={3} maxLength={2000} value={review.comments} onChange={(e) => setReview({ ...review, comments: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReviewOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add review"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add goal</DialogTitle>
            <DialogDescription>Set a goal for an employee to work towards.</DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit(
                "/api/performance/goals",
                { employeeId: goal.employeeId, title: goal.title, description: goal.description || null },
                "Goal added",
                () => setGoalOpen(false),
              );
            }}
          >
            <div>
              <Label htmlFor="goal-emp" className="mb-1.5">Employee</Label>
              <select id="goal-emp" required className={selectClass} value={goal.employeeId} onChange={(e) => setGoal({ ...goal, employeeId: e.target.value })}>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.firstName}{emp.lastName ? ` ${emp.lastName}` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="goal-title" className="mb-1.5">Goal</Label>
              <Input id="goal-title" required maxLength={150} value={goal.title} onChange={(e) => setGoal({ ...goal, title: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="goal-desc" className="mb-1.5">Description</Label>
              <Textarea id="goal-desc" rows={3} maxLength={1000} value={goal.description} onChange={(e) => setGoal({ ...goal, description: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setGoalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add goal"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
