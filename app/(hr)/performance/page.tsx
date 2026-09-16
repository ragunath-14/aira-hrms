"use client";

import { useEffect, useState } from "react";

type PerformanceReview = {
  id: string;
  employeeId: string;
  reviewPeriod: string;
  rating: number | null;
  comments: string | null;
  status: string;
};

export default function PerformancePage() {
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReviews() {
      try {
        const response = await fetch("/api/performance");

        if (response.ok) {
          const data = await response.json();

          setReviews(Array.isArray(data) ? data : []);
        }
      } finally {
        setLoading(false);
      }
    }

    loadReviews();
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Performance
          </h1>

          <p className="mt-2 text-gray-500">
            Employee goals, reviews, ratings and manager comments.
          </p>
        </div>

        {loading ? (
          <p className="text-gray-500">
            Loading performance reviews...
          </p>
        ) : reviews.length === 0 ? (
          <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              No performance reviews
            </h2>

            <p className="mt-2 text-gray-500">
              Performance reviews will appear here when they are created.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b bg-gray-50 text-sm text-gray-500">
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Review Period</th>
                  <th className="px-6 py-4">Rating</th>
                  <th className="px-6 py-4">Comments</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>

              <tbody>
                {reviews.map((review) => (
                  <tr
                    key={review.id}
                    className="border-b last:border-0"
                  >
                    <td className="px-6 py-4 text-sm">
                      {review.employeeId}
                    </td>

                    <td className="px-6 py-4 text-sm">
                      {review.reviewPeriod}
                    </td>

                    <td className="px-6 py-4">
                      {review.rating !== null
                        ? `${review.rating}/5`
                        : "Not rated"}
                    </td>

                    <td className="max-w-md px-6 py-4 text-sm text-gray-600">
                      {review.comments || "No comments"}
                    </td>

                    <td className="px-6 py-4">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-sm">
                        {review.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}