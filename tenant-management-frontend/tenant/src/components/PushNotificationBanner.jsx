// src/components/PushNotificationBanner.jsx
// Drop this anywhere in your layout — it handles all states automatically.
// Recommended: just above or below your <Header /> component.

import { useState } from "react";
import { Bell, BellOff, Share, X } from "lucide-react";
import { usePushNotifications } from "../hooks/usePushNotifications";
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

    const [dismissed, setDismissed] = useState(false);

    if (dismissed || !user) return null;

    // ── iOS, not installed as PWA yet ─────────────────────────────────────────
    if (isIOS && !isStandalone) {
        return (
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mx-4 mt-3">
                <Share className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                <div className="flex-1 text-sm">
                    <p className="font-semibold text-blue-800">Enable push notifications</p>
                    <p className="text-blue-600 mt-0.5">
                        Tap the <strong>Share</strong> button in Safari, then <strong>"Add to Home Screen"</strong>.
                        Open the app from your Home Screen to enable alerts.
                    </p>
                </div>
                <button onClick={() => setDismissed(true)} className="text-blue-400 hover:text-blue-600">
                    <X className="w-4 h-4" />
                </button>
            </div>
        );
    }

    // ── Already subscribed ─────────────────────────────────────────────────────
    if (isSubscribed || permissionState === "granted") return null;

    // ── Permission denied ──────────────────────────────────────────────────────
    if (permissionState === "denied") {
        return (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mx-4 mt-3">
                <BellOff className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                <div className="flex-1 text-sm">
                    <p className="font-semibold text-red-700">Notifications blocked</p>
                    <p className="text-red-500 mt-0.5">
                        Go to your browser settings → Site Settings → Notifications → allow <strong>app.sallyanhouse.com</strong>
                    </p>
                </div>
                <button onClick={() => setDismissed(true)} className="text-red-300 hover:text-red-500">
                    <X className="w-4 h-4" />
                </button>
            </div>
        );
    }

    // ── Not yet asked — show enable button ────────────────────────────────────
    if (!isReady) return null;

    return (
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 mx-4 mt-3">
            <Bell className="w-5 h-5 text-indigo-500 shrink-0" />
            <div className="flex-1 text-sm">
                <p className="font-semibold text-indigo-800">Enable push notifications</p>
                <p className="text-indigo-500 mt-0.5">Get fuel alerts and payment notifications even when this tab is closed.</p>
            </div>
            <button
                onClick={requestPermissionAndSubscribe}
                className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
                Enable
            </button>
            <button onClick={() => setDismissed(true)} className="text-indigo-300 hover:text-indigo-500">
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}