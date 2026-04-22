// src/components/settings/NotificationSettings.jsx

import { useState, useEffect } from "react";
import {
    Bell, BellOff, BellRing, RefreshCw, Smartphone,
    Download, Globe, ShieldAlert, CheckCircle2, AlertCircle,
    ChevronRight, Clock, Save, Zap, CreditCard, CalendarClock,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "../../hooks/usePushNotification";
import { useAuth } from "../../context/AuthContext";
import api from "../../../plugins/axios";
import { toast } from "sonner";

// ── Helper: resolve the platform install reason ────────────────────────────────
function getInstallReason(isIOS) {
    if (isIOS) {
        return {
            icon: Smartphone,
            title: "Install EasyManage to enable notifications",
            description: "iOS requires the app to be installed from Safari to receive push notifications.",
            steps: [
                "Open this page in Safari (not Chrome/Firefox)",
                "Tap the Share icon at the bottom",
                'Tap "Add to Home Screen"',
                "Launch Sallyan House from your Home Screen",
            ],
        };
    }
    return {
        icon: Download,
        title: "Install Sallyan House for full notification support",
        description: "Installing the app unlocks reliable background push notifications.",
        steps: [
            "Click the install icon (⊕) in your browser address bar",
            'Or open browser menu → "Install app"',
            "Launch Sallyan House from the installed app",
        ],
    };
}

// ── Defaults (mirror backend CRON_DEFAULTS) ────────────────────────────────────
const DEFAULT_CRON = {
    rentReminder: { enabled: true, daysBeforeMonthEnd: 7 },
    dailyChecklist: {
        morning: { enabled: true, time: "07:30" },
        escalation: { enabled: true, time: "10:30" },
        eod: { enabled: true, time: "16:30" },
    },
    electricityOverdue: { enabled: true, overdueDays: 30 },
    lateFeeNotify: { enabled: true },
    loanEmiReminder: { enabled: true },
};

// ── Cron schedule section (admin-only) ────────────────────────────────────────
function CronScheduleSettings() {
    const [cfg, setCfg] = useState(DEFAULT_CRON);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get("/api/settings/cron")
            .then((r) => { if (r.data.success) setCfg(r.data.data); })
            .catch(() => toast.error("Failed to load schedule settings"))
            .finally(() => setLoading(false));
    }, []);

    const save = async () => {
        setSaving(true);
        try {
            const r = await api.post("/api/settings/cron", cfg);
            if (r.data.success) toast.success("Schedule settings saved");
            else toast.error(r.data.message || "Failed to save");
        } catch {
            toast.error("Failed to save schedule settings");
        } finally {
            setSaving(false);
        }
    };

    const setChecklist = (key, patch) =>
        setCfg((s) => ({
            ...s,
            dailyChecklist: {
                ...s.dailyChecklist,
                [key]: { ...s.dailyChecklist[key], ...patch },
            },
        }));

    const SectionLabel = ({ children }) => (
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
            style={{ color: "var(--color-text-weak)" }}>{children}</p>
    );

    const RowCard = ({ children }) => (
        <div className="rounded-xl border px-4 py-3 space-y-3"
            style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border)" }}>
            {children}
        </div>
    );

    const Row = ({ label, desc, checked, onToggle, children }) => (
        <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--color-text-strong)" }}>{label}</p>
                {desc && <p className="text-[12px] mt-0.5" style={{ color: "var(--color-text-sub)" }}>{desc}</p>}
                {children}
            </div>
            <Switch checked={checked} onCheckedChange={onToggle} />
        </div>
    );

    if (loading) {
        return (
            <div className="space-y-2 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 rounded-xl border"
                        style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border)" }} />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Rent Reminder */}
            <div>
                <SectionLabel>Rent Reminder</SectionLabel>
                <RowCard>
                    <Row
                        label="Month-end reminder"
                        desc="Notify admins when rent is still unpaid near month-end."
                        checked={cfg.rentReminder.enabled}
                        onToggle={(v) => setCfg((s) => ({ ...s, rentReminder: { ...s.rentReminder, enabled: v } }))}
                    >
                        {cfg.rentReminder.enabled && (
                            <div className="flex items-center gap-2 mt-2">
                                <Label className="text-xs text-muted-foreground whitespace-nowrap">Days before month end</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={28}
                                    className="h-8 w-20 text-sm"
                                    value={cfg.rentReminder.daysBeforeMonthEnd}
                                    onChange={(e) =>
                                        setCfg((s) => ({
                                            ...s,
                                            rentReminder: { ...s.rentReminder, daysBeforeMonthEnd: Number(e.target.value) },
                                        }))
                                    }
                                />
                            </div>
                        )}
                    </Row>
                </RowCard>
            </div>

            {/* Daily Checklist */}
            <div>
                <SectionLabel>Daily Checklist Notifications</SectionLabel>
                <RowCard>
                    <div className="space-y-4 divide-y" style={{ borderColor: "var(--color-border)" }}>
                        {[
                            { key: "morning", label: "Morning — checklist creation", desc: "Sent when daily checklists are created and ready." },
                            { key: "escalation", label: "Mid-day escalation", desc: "Sent if checklists are still pending mid-morning." },
                            { key: "eod", label: "End-of-day warning", desc: "Sent if any checklist is incomplete by day-end." },
                        ].map(({ key, label, desc }, i) => (
                            <div key={key} className={i > 0 ? "pt-3" : ""}>
                                <Row
                                    label={label}
                                    desc={desc}
                                    checked={cfg.dailyChecklist[key].enabled}
                                    onToggle={(v) => setChecklist(key, { enabled: v })}
                                >
                                    {cfg.dailyChecklist[key].enabled && (
                                        <div className="flex items-center gap-2 mt-2">
                                            <Clock className="w-3.5 h-3.5" style={{ color: "var(--color-text-weak)" }} />
                                            <Input
                                                type="time"
                                                className="h-8 w-32 text-sm"
                                                value={cfg.dailyChecklist[key].time}
                                                onChange={(e) => setChecklist(key, { time: e.target.value })}
                                            />
                                        </div>
                                    )}
                                </Row>
                            </div>
                        ))}
                    </div>
                </RowCard>
            </div>

            {/* Electricity Overdue */}
            <div>
                <SectionLabel>Electricity Bills</SectionLabel>
                <RowCard>
                    <Row
                        label="Overdue bill alerts"
                        desc="Notify admins when electricity bills have been pending too long."
                        checked={cfg.electricityOverdue.enabled}
                        onToggle={(v) => setCfg((s) => ({ ...s, electricityOverdue: { ...s.electricityOverdue, enabled: v } }))}
                    >
                        {cfg.electricityOverdue.enabled && (
                            <div className="flex items-center gap-2 mt-2">
                                <Label className="text-xs text-muted-foreground whitespace-nowrap">Mark overdue after (days)</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={365}
                                    className="h-8 w-20 text-sm"
                                    value={cfg.electricityOverdue.overdueDays}
                                    onChange={(e) =>
                                        setCfg((s) => ({
                                            ...s,
                                            electricityOverdue: { ...s.electricityOverdue, overdueDays: Number(e.target.value) },
                                        }))
                                    }
                                />
                            </div>
                        )}
                    </Row>
                </RowCard>
            </div>

            {/* Late Fee & Loan EMI */}
            <div>
                <SectionLabel>Other Alerts</SectionLabel>
                <RowCard>
                    <div className="space-y-4 divide-y" style={{ borderColor: "var(--color-border)" }}>
                        <Row
                            label="Late fee applied"
                            desc="Notify admins when late fees are automatically charged."
                            checked={cfg.lateFeeNotify.enabled}
                            onToggle={(v) => setCfg((s) => ({ ...s, lateFeeNotify: { enabled: v } }))}
                        />
                        <div className="pt-3">
                            <Row
                                label="Loan EMI reminders"
                                desc="Remind admins about upcoming loan EMI payments."
                                checked={cfg.loanEmiReminder.enabled}
                                onToggle={(v) => setCfg((s) => ({ ...s, loanEmiReminder: { enabled: v } }))}
                            />
                        </div>
                    </div>
                </RowCard>
            </div>

            <Button
                className="gap-2 h-8 text-xs px-4"
                onClick={save}
                disabled={saving}
            >
                <Save className="w-3.5 h-3.5" />
                {saving ? "Saving…" : "Save Schedule Settings"}
            </Button>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NotificationSettings() {
    const { user } = useAuth();
    const {
        isReady,
        isSubscribed,
        isIOS,
        isStandalone,
        permissionState,
        browserSupportsPush,
        requestPermissionAndSubscribe,
        unsubscribe,
        resubscribe,
    } = usePushNotifications(user);

    const [toggleState, setToggleState] = useState("idle");
    const [resubState, setResubState] = useState("idle");

    const isAdmin = ["super_admin", "admin"].includes(user?.role);

    const handleToggle = async (checked) => {
        setToggleState("loading");
        try {
            if (checked) await requestPermissionAndSubscribe();
            else await unsubscribe();
            setToggleState("success");
            setTimeout(() => setToggleState("idle"), 2000);
        } catch {
            setToggleState("error");
            setTimeout(() => setToggleState("idle"), 3000);
        }
    };

    const handleResubscribe = async () => {
        setResubState("loading");
        try {
            await resubscribe();
            setResubState("success");
            setTimeout(() => setResubState("idle"), 2500);
        } catch {
            setResubState("error");
            setTimeout(() => setResubState("idle"), 3000);
        }
    };

    const SectionTitle = ({ children }) => (
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-3"
            style={{ color: "var(--color-text-weak)" }}>
            {children}
        </p>
    );

    const Card = ({ children, className = "" }) => (
        <div
            className={`rounded-xl border p-4 ${className}`}
            style={{
                background: "var(--color-surface-raised)",
                borderColor: "var(--color-border)",
            }}
        >
            {children}
        </div>
    );

    const StatusDot = ({ active }) => (
        <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: active ? "var(--color-success, #22c55e)" : "var(--color-text-weak)" }}
        />
    );

    const Steps = ({ steps }) => (
        <ol className="mt-3 flex flex-col gap-2">
            {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13px]"
                    style={{ color: "var(--color-text-body)" }}>
                    <span
                        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold mt-[1px]"
                        style={{ background: "var(--color-accent)", color: "#fff" }}
                    >
                        {i + 1}
                    </span>
                    {step}
                </li>
            ))}
        </ol>
    );

    if (!browserSupportsPush) {
        return (
            <div className="flex flex-col gap-6">
                <SectionTitle>Push Notifications</SectionTitle>
                <Card>
                    <div className="flex items-start gap-3">
                        <Globe className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--color-warning, #d97706)" }} />
                        <div>
                            <p className="text-sm font-semibold" style={{ color: "var(--color-text-strong)" }}>
                                Browser not supported
                            </p>
                            <p className="text-[13px] mt-1" style={{ color: "var(--color-text-sub)" }}>
                                Your current browser can't receive push notifications. Switch to one of these:
                            </p>
                            <div className="mt-3 flex flex-col gap-1.5">
                                {["Chrome 50+", "Microsoft Edge 17+", "Firefox 44+", "Safari 16.4+ (as installed PWA)"].map(b => (
                                    <div key={b} className="flex items-center gap-2 text-[13px]"
                                        style={{ color: "var(--color-text-body)" }}>
                                        <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--color-accent)" }} />
                                        {b}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Card>
                {isAdmin && (
                    <>
                        <div className="border-t pt-6" style={{ borderColor: "var(--color-border)" }}>
                            <SectionTitle>Notification Schedule</SectionTitle>
                            <CronScheduleSettings />
                        </div>
                    </>
                )}
            </div>
        );
    }

    if (!isStandalone) {
        const reason = getInstallReason(isIOS);
        const Icon = reason.icon;
        return (
            <div className="flex flex-col gap-6">
                <SectionTitle>Push Notifications</SectionTitle>
                <Card>
                    <div className="flex items-start gap-3">
                        <Icon className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--color-accent)" }} />
                        <div className="flex-1">
                            <p className="text-sm font-semibold" style={{ color: "var(--color-text-strong)" }}>
                                {reason.title}
                            </p>
                            <p className="text-[13px] mt-1" style={{ color: "var(--color-text-sub)" }}>
                                {reason.description}
                            </p>
                            <Steps steps={reason.steps} />
                        </div>
                    </div>
                </Card>

                {!isIOS && isReady && (
                    <Card>
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-medium" style={{ color: "var(--color-text-strong)" }}>
                                    Enable in this browser tab
                                </p>
                                <p className="text-[12px] mt-0.5" style={{ color: "var(--color-text-weak)" }}>
                                    Less reliable than the installed app — notifications may not arrive when the tab is closed.
                                </p>
                            </div>
                            <Switch
                                checked={isSubscribed}
                                disabled={toggleState === "loading" || permissionState === "denied"}
                                onCheckedChange={handleToggle}
                            />
                        </div>
                    </Card>
                )}

                {isAdmin && (
                    <div className="border-t pt-6" style={{ borderColor: "var(--color-border)" }}>
                        <SectionTitle>Notification Schedule</SectionTitle>
                        <CronScheduleSettings />
                    </div>
                )}
            </div>
        );
    }

    if (permissionState === "denied") {
        return (
            <div className="flex flex-col gap-6">
                <SectionTitle>Push Notifications</SectionTitle>
                <Card>
                    <div className="flex items-start gap-3">
                        <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--color-danger)" }} />
                        <div>
                            <p className="text-sm font-semibold" style={{ color: "var(--color-text-strong)" }}>
                                Notifications are blocked
                            </p>
                            <p className="text-[13px] mt-1" style={{ color: "var(--color-text-sub)" }}>
                                You've blocked notifications for Sallyan House. Re-enable them in your device settings — this can't be changed from within the app.
                            </p>
                            <Steps steps={
                                isIOS
                                    ? [
                                        "Open iOS Settings",
                                        "Scroll to Sallyan House",
                                        "Tap Notifications → Allow Notifications",
                                    ]
                                    : [
                                        "Click the lock / info icon in the address bar",
                                        'Set Notifications → "Allow"',
                                        "Reload the app",
                                    ]
                            } />
                        </div>
                    </div>
                </Card>
                {isAdmin && (
                    <div className="border-t pt-6" style={{ borderColor: "var(--color-border)" }}>
                        <SectionTitle>Notification Schedule</SectionTitle>
                        <CronScheduleSettings />
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <SectionTitle>Push Notifications</SectionTitle>

            <Card>
                <div className="flex items-center gap-4">
                    <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: isSubscribed ? "var(--color-accent-light)" : "var(--color-surface)" }}
                    >
                        {isSubscribed
                            ? <BellRing className="w-4.5 h-4.5" style={{ color: "var(--color-accent)" }} />
                            : <BellOff className="w-4.5 h-4.5" style={{ color: "var(--color-text-weak)" }} />
                        }
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold" style={{ color: "var(--color-text-strong)" }}>
                                Push Notifications
                            </p>
                            <StatusDot active={isSubscribed} />
                            <span className="text-[12px]" style={{ color: "var(--color-text-weak)" }}>
                                {isSubscribed ? "Active" : "Off"}
                            </span>
                        </div>
                        <p className="text-[12px] mt-0.5" style={{ color: "var(--color-text-sub)" }}>
                            Rent dues, tenant requests, inspection alerts
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {toggleState === "success" && (
                            <CheckCircle2 className="w-4 h-4" style={{ color: "var(--color-success, #22c55e)" }} />
                        )}
                        {toggleState === "error" && (
                            <AlertCircle className="w-4 h-4" style={{ color: "var(--color-danger)" }} />
                        )}
                        <Switch
                            checked={isSubscribed}
                            disabled={toggleState === "loading"}
                            onCheckedChange={handleToggle}
                            aria-label="Toggle push notifications"
                        />
                    </div>
                </div>
            </Card>

            {isSubscribed && (
                <Card>
                    <div className="flex items-start gap-3">
                        <RefreshCw
                            className={`w-4 h-4 mt-0.5 shrink-0 ${resubState === "loading" ? "animate-spin" : ""}`}
                            style={{ color: "var(--color-text-sub)" }}
                        />
                        <div className="flex-1">
                            <p className="text-sm font-medium" style={{ color: "var(--color-text-strong)" }}>
                                Not receiving notifications?
                            </p>
                            <p className="text-[12px] mt-1" style={{ color: "var(--color-text-sub)" }}>
                                Refreshes your device's subscription with our server. Use this if alerts stopped arriving — no reinstall needed.
                            </p>
                            <button
                                onClick={handleResubscribe}
                                disabled={resubState === "loading"}
                                className="mt-2.5 flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5
                           rounded-lg border transition-colors disabled:opacity-50"
                                style={{
                                    color: resubState === "success" ? "var(--color-success, #22c55e)"
                                        : resubState === "error" ? "var(--color-danger)"
                                            : "var(--color-accent)",
                                    borderColor: resubState === "success" ? "var(--color-success, #22c55e)"
                                        : resubState === "error" ? "var(--color-danger)"
                                            : "var(--color-accent-mid)",
                                    background: "transparent",
                                }}
                            >
                                {resubState === "loading" && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                {resubState === "success" && <CheckCircle2 className="w-3.5 h-3.5" />}
                                {resubState === "error" && <AlertCircle className="w-3.5 h-3.5" />}

                                {resubState === "idle" && "Re-subscribe"}
                                {resubState === "loading" && "Refreshing…"}
                                {resubState === "success" && "Done! Check your notifications"}
                                {resubState === "error" && "Failed — try again"}
                            </button>
                        </div>
                    </div>
                </Card>
            )}

            {isAdmin && (
                <div className="border-t pt-6" style={{ borderColor: "var(--color-border)" }}>
                    <SectionTitle>Notification Schedule</SectionTitle>
                    <CronScheduleSettings />
                </div>
            )}
        </div>
    );
}
