// src/components/PushNotificationBanner.jsx
import { useState } from "react";
import { createPortal } from "react-dom";
import { Bell, BellOff, Share, X } from "lucide-react";
import { usePushNotifications } from "../hooks/usePushNotification";
import { useAuth } from "../context/AuthContext";

const STYLE = `
@keyframes pnb-slide-in {
  from { opacity: 0; transform: translateY(-8px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)   scale(1);    }
}
.pnb-enter {
  animation: pnb-slide-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
`;

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

    // FIX 1: Don't pre-dismiss when user is null — that's just auth loading.
    // The render guard below already handles the !user case correctly.
    const [dismissed, setDismissed] = useState(() => {
        if (!user) return false;
        return localStorage.getItem(`pushDismissed_${user._id || user.id}`) === "true";
    });

    const dismiss = () => {
        if (user) localStorage.setItem(`pushDismissed_${user._id || user.id}`, "true");
        setDismissed(true);
    };

    // All early-exit conditions
    if (dismissed || !user || !isReady || isSubscribed || permissionState === "granted") return null;

    const container = `
    pnb-enter
    fixed top-[57px] right-3 left-3
    sm:left-auto sm:right-4 sm:w-[340px]
    z-50
    flex items-start gap-2.5
    rounded-xl px-3 py-2.5
    border shadow-lg shadow-black/[0.07]
    backdrop-blur-sm
  `.replace(/\s+/g, " ").trim();

    // FIX 2: Compute content into a variable so we portal it once at the end,
    // instead of three separate returns that each need their own createPortal.
    let content;

    if (isIOS && !isStandalone) {
        content = (
            <div
                className={container}
                style={{ background: "rgba(212,228,245,0.97)", borderColor: "rgba(46,90,140,0.2)" }}
            >
                <Share className="w-3.5 h-3.5 mt-[3px] shrink-0" style={{ color: "#2E5A8C" }} />
                <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold leading-snug" style={{ color: "#1A2E4A" }}>
                        Add to Home Screen for notifications
                    </p>
                    <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "#4A78A8" }}>
                        Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>, then allow notifications.
                    </p>
                </div>
                <button
                    onClick={dismiss}
                    className="shrink-0 mt-0.5 rounded-md p-0.5 transition-opacity hover:opacity-60"
                    style={{ color: "#4A78A8" }}
                    aria-label="Dismiss"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        );
    } else if (permissionState === "denied") {
        content = (
            <div
                className={container}
                style={{ background: "rgba(245,213,213,0.97)", borderColor: "rgba(176,32,32,0.18)" }}
            >
                <BellOff className="w-3.5 h-3.5 mt-[3px] shrink-0" style={{ color: "#B02020" }} />
                <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold leading-snug" style={{ color: "#5C1414" }}>
                        Notifications blocked
                    </p>
                    <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "#B02020" }}>
                        Go to <strong>Site Settings → Notifications</strong> and allow this site.
                    </p>
                </div>
                <button
                    onClick={dismiss}
                    className="shrink-0 mt-0.5 rounded-md p-0.5 transition-opacity hover:opacity-60"
                    style={{ color: "#C47272" }}
                    aria-label="Dismiss"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        );
    } else {
        content = (
            <div
                className={container}
                style={{ background: "rgba(238,233,229,0.97)", borderColor: "#DDD6D0" }}
            >
                <Bell className="w-3.5 h-3.5 mt-[3px] shrink-0" style={{ color: "#3D1414" }} />
                <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold leading-snug" style={{ color: "#3D1414" }}>
                        Enable Push Notifications for Sallyan House
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "#948472" }}>
                        Get alerts even when this tab is closed.
                    </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    <button
                        onClick={requestPermissionAndSubscribe}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all
                       hover:opacity-90 active:scale-95 text-white bg-primary"
                    >
                        Enable
                    </button>
                    <button
                        onClick={dismiss}
                        className="rounded-md p-0.5 transition-opacity hover:opacity-60"
                        style={{ color: "#C8BDB6" }}
                        aria-label="Dismiss"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        );
    }

    // Single portal call — mounts directly on document.body, completely
    // outside the header/sidebar DOM tree, so no ancestor transform or
    // overflow can ever re-anchor or clip the fixed positioning.
    return createPortal(
        <>
            <style>{STYLE}</style>
            {content}
        </>,
        document.body
    );
}