"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAlerts } from "@/lib/hooks/use-alerts";
import { useUser } from "@/lib/hooks/use-user";
import { AlertCard } from "@/components/alert-card";
import { AlertFilters } from "@/components/alert-filters";
import { StatsBar } from "@/components/stats-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function AlertFeed() {
  const [filters, setFilters] = useState({
    cameras: [] as string[],
    severities: [] as number[],
    sortBy: "captured_at" as "captured_at" | "severity_num",
    ackFilter: "all" as "all" | "ack" | "unack",
    starFilter: "all" as "all" | "starred",
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { alerts, acknowledgedIds, totalCount, loading, loadingMore, hasMore, loadMore, refetch } = useAlerts({
    cameras: filters.cameras.length > 0 ? filters.cameras : undefined,
    severities: filters.severities.length > 0 ? filters.severities : undefined,
    starred: filters.starFilter === "starred" ? true : undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortBy === "severity_num" ? "desc" : "desc",
  });

  const { user, isAdmin } = useUser();
  const supabase = createClient();

  const filteredAlerts = alerts.filter((alert) => {
    if (filters.ackFilter === "ack" && !acknowledgedIds.has(alert.id)) return false;
    if (filters.ackFilter === "unack" && acknowledgedIds.has(alert.id)) return false;
    return true;
  });

  async function handleAcknowledge(alertId: string) {
    if (!user) return;
    await supabase.from("alert_acknowledgments").insert({
      alert_id: alertId,
      user_id: user.id,
    });
  }

  async function handleFalsePositive(alertId: string) {
    const { error } = await supabase
      .from("alerts")
      .update({ false_positive: true })
      .eq("id", alertId);
    if (error) {
      console.error("False positive failed:", error);
      return;
    }
    refetch();
  }

  async function handleStar(alertId: string, starred: boolean) {
    await supabase.from("alerts").update({ starred }).eq("id", alertId);
    refetch();
  }

  async function handleDelete(alertId: string) {
    const alert = alerts.find((a) => a.id === alertId);
    const { error } = await supabase.from("alerts").delete().eq("id", alertId);
    if (error) {
      console.error("Delete failed:", error);
      window.alert("Delete failed: " + error.message);
      return;
    }
    if (alert?.image_path) {
      await supabase.storage.from("alert-images").remove([alert.image_path]);
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} alert(s)?`)) return;

    setDeleting(true);
    const ids = Array.from(selectedIds);
    const imagePaths = alerts
      .filter((a) => selectedIds.has(a.id) && a.image_path)
      .map((a) => a.image_path);

    const { error } = await supabase.from("alerts").delete().in("id", ids);
    if (error) {
      console.error("Bulk delete failed:", error);
      window.alert("Bulk delete failed: " + error.message);
      setDeleting(false);
      return;
    }
    if (imagePaths.length > 0) {
      await supabase.storage.from("alert-images").remove(imagePaths);
    }
    setSelectedIds(new Set());
    setSelectMode(false);
    setDeleting(false);
  }

  function toggleSelect(alertId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(alertId)) next.delete(alertId);
      else next.add(alertId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredAlerts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAlerts.map((a) => a.id)));
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StatsBar totalCount={totalCount} />
      <AlertFilters value={filters} onChange={setFilters} />

      {/* Bulk actions bar (admin only) */}
      {isAdmin && (
        <div className="flex items-center gap-2">
          {!selectMode ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSelectMode(true)}
            >
              Select
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={toggleSelectAll}
              >
                {selectedIds.size === filteredAlerts.length ? "Deselect All" : "Select All"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
                disabled={selectedIds.size === 0 || deleting}
                onClick={handleBulkDelete}
              >
                {deleting
                  ? "Deleting..."
                  : `Delete${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setSelectMode(false);
                  setSelectedIds(new Set());
                }}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      )}

      {filteredAlerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <svg className="h-12 w-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <p className="text-sm">No alerts found</p>
          <p className="text-xs mt-1">Alerts will appear here in real-time</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredAlerts.map((alert) => (
            <div key={alert.id} className="flex items-center gap-2">
              {selectMode && (
                <button
                  onClick={() => toggleSelect(alert.id)}
                  className="flex-shrink-0"
                >
                  <div
                    className={`h-4 w-4 rounded border transition-colors ${
                      selectedIds.has(alert.id)
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/40"
                    }`}
                  >
                    {selectedIds.has(alert.id) && (
                      <svg className="h-4 w-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                  </div>
                </button>
              )}
              <div className="flex-1 min-w-0">
                <AlertCard
                  alert={alert}
                  acknowledged={acknowledgedIds.has(alert.id)}
                  onAcknowledge={handleAcknowledge}
                  onFilterCamera={(cam) => setFilters((f) => ({ ...f, cameras: [cam] }))}
                  onFalsePositive={handleFalsePositive}
                  onStar={handleStar}
                  onDelete={handleDelete}
                  isAdmin={isAdmin}
                />
              </div>
            </div>
          ))}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading..." : "Load More"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
