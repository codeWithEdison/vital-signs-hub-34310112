import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface VitalRecord {
  id: string;
  temperature: number;
  heart_rate: number;
  spo2: number;
  status: string;
  recommendation: string;
  created_at: string;
}

const PAGE_SIZE = 20;

export function useVitals() {
  const [records, setRecords] = useState<VitalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [chartRecords, setChartRecords] = useState<VitalRecord[]>([]);

  // Fetch total count
  useEffect(() => {
    async function fetchCount() {
      const { count } = await supabase
        .from("vitals")
        .select("*", { count: "exact", head: true });
      setTotalCount(count ?? 0);
    }
    fetchCount();
  }, []);

  // Fetch chart data (latest 20)
  useEffect(() => {
    async function fetchChart() {
      const { data } = await supabase
        .from("vitals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) setChartRecords(data as VitalRecord[]);
    }
    fetchChart();
  }, []);

  // Fetch paginated data
  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    const from = (p - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("vitals")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (!error && data) {
      setRecords(data as VitalRecord[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPage(page);
  }, [page, fetchPage]);

  // Subscribe to realtime inserts
  useEffect(() => {
    const channel = supabase
      .channel("vitals-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "vitals" },
        (payload) => {
          setTotalCount((c) => c + 1);
          if (page === 1) {
            setRecords((prev) => [payload.new as VitalRecord, ...prev].slice(0, PAGE_SIZE));
          }
          setChartRecords((prev) => [payload.new as VitalRecord, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [page]);

  const latest = page === 1 ? records[0] ?? null : null;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return { records, latest: latest || (chartRecords[0] ?? null), loading, totalCount, page, setPage, totalPages, chartRecords, PAGE_SIZE };
}
