// src/components/settings/NotificationSettings.tsx
//
// Drop this into any settings page/tab.
// Handles every state a user can be in, including recovery ("not getting notifs").

import { useState } from "react";
import {
    Bell, BellOff, BellRing, RefreshCw, Smartphone,
    Download, Globe, ShieldAlert, CheckCircle2, AlertCircle,
    ChevronRight,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { usePushNotifications } from "../../hooks/usePushNotification";
import { useAuth } from "../../context/AuthContext";



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

    // ── Toggle handler ─────────────────────────────────────────────────────────
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

    // ── Re-subscribe (fix) handler ─────────────────────────────────────────────
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

    // ── Sub-components ─────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────────────────────────
    // RENDER: Browser doesn't support push at all
    // ─────────────────────────────────────────────────────────────────────────────
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
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // RENDER: Not installed as PWA (needs install first)
    // ─────────────────────────────────────────────────────────────────────────────
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

                {/* For non-iOS, still allow browser-tab subscription as fallback */}
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
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // RENDER: Permission blocked by browser/OS
    // ─────────────────────────────────────────────────────────────────────────────
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
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // RENDER: Normal state — subscribed or not, with full controls
    // ─────────────────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-6">
            <SectionTitle>Push Notifications</SectionTitle>

            {/* ── Main toggle card ── */}
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

                    {/* Toggle with feedback */}
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

            {/* ── Recovery card — only shown when subscribed ── */}
            {/* 
        This is the KEY product design decision:
        Show "Fix notifications" even when subscribed — because a subscribed-but-broken
        state is invisible to the user. They won't know unless they see this option.
      */}
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
        </div>
    );
}