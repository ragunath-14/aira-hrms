"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, TargetIcon } from "lucide-react";

import { PageHeader } from "@/components/hr/page-header";
import { StatusBadge } from "@/components/hr/status-badge";
import { EmptyState } from "@/components/hr/empty-state";
import {
  DataTablePagination,
  paginate,
} from "@/components/hr/data-table-pagination";
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

  useEffect(() => {
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
    </div>
  );
}
