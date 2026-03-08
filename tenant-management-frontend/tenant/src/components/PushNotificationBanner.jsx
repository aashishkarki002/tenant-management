// src/components/PushNotificationBanner.jsx
// Single source of truth for the push notification opt-in banner.
// Rendered inside <Header /> — do NOT render this anywhere else.

import { useState } from "react";
import { Bell, BellOff, Share, X } from "lucide-react";
import { usePushNotifications } from "../hooks/usePushNotification";
import { useAuth } from "../context/AuthContext";

export default function PushNotificationBanner() {
    const { user } = useAuth();
    const {
        permissionState,
        isReady,
        isSubscribed,
        isIOS,
        isStandalone,
        requestPermissionAndSubscribe,
    } = usePushNotifications(user);

    const [dismissed, setDismissed] = useState(() => {
        if (!user) return true;
        return localStorage.getItem(`pushDismissed_${user._id || user.id}`) === "true";
    });

    const dismiss = () => {
        if (user) localStorage.setItem(`pushDismissed_${user._id || user.id}`, "true");
        setDismissed(true);
    };

    // Never show if: dismissed, no user, hook not ready, already subscribed/granted
    if (dismissed || !user || !isReady || isSubscribed || permissionState === "granted") return null;

    // ── iOS: not installed as PWA yet ─────────────────────────────────────────
    if (isIOS && !isStandalone) {
        return (
            <div className="flex items-start gap-3 rounded-xl px-4 py-3 mx-4 mb-2 border"
                style={{ background: "#D4E4F5", borderColor: "rgba(46,90,140,0.25)" }}>
                <Share className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#2E5A8C" }} />
                <div className="flex-1 text-sm">
                    <p className="font-semibold" style={{ color: "#1A2E4A" }}>
                        Add to Home Screen for notifications
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: "#2E5A8C" }}>
                        Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>, then open the app and allow notifications.
                    </p>
                </div>
                <button onClick={dismiss} className="transition-colors" style={{ color: "#2E5A8C" }}>
                    <X className="w-4 h-4" />
                </button>
            </div>
        );
    }

    // ── Permission explicitly denied ──────────────────────────────────────────
    if (permissionState === "denied") {
        return (
            <div className="flex items-start gap-3 rounded-xl px-4 py-3 mx-4 mb-2 border"
                style={{ background: "#F5D5D5", borderColor: "rgba(176,32,32,0.25)" }}>
                <BellOff className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#B02020" }} />
                <div className="flex-1 text-sm">
                    <p className="font-semibold" style={{ color: "#5C1414" }}>Notifications blocked</p>
                    <p className="mt-0.5 text-xs" style={{ color: "#B02020" }}>
                        Go to <strong>Site Settings → Notifications</strong> and allow <strong>app.sallyanhouse.com</strong>
                    </p>
                </div>
                <button onClick={dismiss} className="transition-colors" style={{ color: "#C47272" }}>
                    <X className="w-4 h-4" />
                </button>
            </div>
        );
    }

    // ── Default: prompt user to enable ───────────────────────────────────────
    return (
        <div className="flex items-center gap-3 rounded-xl px-4 py-2.5 mx-4 mb-2 border"
            style={{ background: "#EEE9E5", borderColor: "#DDD6D0" }}>
            <Bell className="w-4 h-4 shrink-0" style={{ color: "#3D1414" }} />
            <div className="flex-1 text-sm">
                <p className="font-semibold text-[13px]" style={{ color: "#3D1414" }}>
                    Stay on top of payments &amp; maintenance
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#948472" }}>
                    Enable notifications to get alerts even when this tab is closed.
                </p>
            </div>
            <button
                onClick={requestPermissionAndSubscribe}
                className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all
                           hover:opacity-90 active:scale-95"
                style={{ background: "#3D1414", color: "#F0DADA" }}
            >
                Enable
            </button>
            <button onClick={dismiss} className="transition-colors" style={{ color: "#C8BDB6" }}>
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}