import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";

function buildParams(quarter, startDate, endDate, month, fiscalYear, entityId) {
    const params = {};
    if (fiscalYear) params.fiscalYear = fiscalYear;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (!startDate && !endDate) {
        if (month) params.month = month;
        else if (quarter) params.quarter = quarter;
    }
    if (entityId) params.entityId = entityId;
    return params;
}

export function useCollectionSummary(
    quarter,
    startDate = "",
    endDate = "",
    month = null,
    fiscalYear = null,
    entityId = null,
) {
    const [collectionGap, setCollectionGap] = useState(null);
    const [incomeStreams, setIncomeStreams] = useState(null);
    const [trend, setTrend] = useState([]);
    const [unpaidRents, setUnpaidRents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchSummary = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const params = buildParams(quarter, startDate, endDate, month, fiscalYear, entityId);
            const response = await api.get("/api/accounting/summary", { params });
            const data = response.data.data;
            const rawGap = data?.collectionGap ?? null;

            if (rawGap) {
                const outstandingPaisa = (rawGap.billedPaisa ?? 0) - (rawGap.collectedPaisa ?? 0);
                setCollectionGap({ ...rawGap, outstandingPaisa });
            } else {
                setCollectionGap(null);
            }

            setIncomeStreams(data?.incomeStreams ?? null);
            setTrend(Array.isArray(data?.trend) ? data.trend : []);
        } catch (err) {
            console.error("[useCollectionSummary] summary fetch failed", err);
            setError("Failed to load collection data");
        } finally {
            setLoading(false);
        }
    }, [quarter, startDate, endDate, month, fiscalYear, entityId]);

    const fetchUnpaidRents = useCallback(async () => {
        try {
            const baseParams = {};
            if (fiscalYear) baseParams.nepaliYear = fiscalYear;
            if (month) baseParams.nepaliMonth = month;
            if (entityId) baseParams.entityId = entityId;

            const [overdueRes, pendingRes] = await Promise.all([
                api.get("/api/rent/get-rents", { params: { ...baseParams, status: "overdue" } }),
                api.get("/api/rent/get-rents", { params: { ...baseParams, status: "pending" } }),
            ]);

            const overdueList = Array.isArray(overdueRes.data?.data)
                ? overdueRes.data.data
                : Array.isArray(overdueRes.data?.rents)
                    ? overdueRes.data.rents
                    : [];

            const pendingList = Array.isArray(pendingRes.data?.data)
                ? pendingRes.data.data
                : Array.isArray(pendingRes.data?.rents)
                    ? pendingRes.data.rents
                    : [];

            const merged = [...overdueList, ...pendingList].map((rent) => {
                const grossPaisa = rent.grossRentAmountPaisa ?? 0;
                const tdsPaisa = rent.tdsAmountPaisa ?? 0;
                const paidPaisa = rent.paidAmountPaisa ?? 0;
                const outstandingPaisa = (grossPaisa - tdsPaisa) - paidPaisa;

                return {
                    _id: rent._id,
                    tenantName: rent.tenant?.name ?? rent.tenantName ?? "—",
                    blockName: rent.blockName ?? rent.block?.name ?? "—",
                    unitLabel: rent.unitLabel ?? rent.unit?.label ?? rent.unit?.unitNumber ?? "—",
                    englishDueDate: rent.englishDueDate ?? null,
                    outstandingPaisa,
                    status: rent.status,
                };
            });

            merged.sort((a, b) => b.outstandingPaisa - a.outstandingPaisa);
            setUnpaidRents(merged.slice(0, 10));
        } catch (err) {
            console.error("[useCollectionSummary] unpaid rents fetch failed", err);
            setUnpaidRents([]);
        }
    }, [fiscalYear, month, entityId]);

    const refetch = useCallback(() => {
        fetchSummary();
        fetchUnpaidRents();
    }, [fetchSummary, fetchUnpaidRents]);

    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    useEffect(() => {
        fetchUnpaidRents();
    }, [fetchUnpaidRents]);

    return { collectionGap, incomeStreams, trend, unpaidRents, loading, error, refetch };
}
