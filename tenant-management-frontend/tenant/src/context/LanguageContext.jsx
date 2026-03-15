/**
 * LanguageContext.jsx
 *
 * Single responsibility: decide which locale is active and expose a toggle.
 *
 * Rules:
 *  1. Role drives the DEFAULT — staff → "ne", everyone else → "en".
 *  2. The user can manually override via the toggle button.
 *  3. The override is persisted to localStorage under "em_lang_override"
 *     so it survives page refreshes within the same browser session.
 *  4. On logout (user becomes null) the override is cleared so the next
 *     login gets the correct role-based default.
 *
 * Consumers:
 *  - useLanguage() — { locale, isNepali, toggle, setLocale }
 *  - The toggle button component reads `isNepali` and calls `toggle()`
 *  - Components call `useTranslation()` from react-i18next directly;
 *    this context just keeps i18n.language in sync.
 */

import {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
} from "react";
import i18n from "../../utils/i18n.js";
import { useAuth } from "./AuthContext";

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "em_lang_override"; // localStorage key
const STAFF_LOCALE = "ne";
const DEFAULT_LOCALE = "en";

function roleToLocale(role) {
    return role === "staff" ? STAFF_LOCALE : DEFAULT_LOCALE;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
    const { user } = useAuth();

    // Resolve initial locale:
    //  - If a manual override exists in localStorage, honour it.
    //  - Otherwise derive from role.
    const [locale, setLocaleState] = useState(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === "ne" || stored === "en") return stored;
        return roleToLocale(user?.role);
    });

    // Keep i18next in sync whenever locale state changes
    useEffect(() => {
        if (i18n.language !== locale) {
            i18n.changeLanguage(locale);
        }
    }, [locale]);

    // When the authenticated user changes (login / logout / role change):
    //  - On logout (user null): clear the override so the next login gets a
    //    fresh role-based default.
    //  - On login: if no manual override exists, apply the role default.
    useEffect(() => {
        if (!user) {
            // Logged out — wipe the override
            localStorage.removeItem(STORAGE_KEY);
            setLocaleState(DEFAULT_LOCALE);
            return;
        }

        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            // Fresh login with no override — apply role default
            const roleLocale = roleToLocale(user.role);
            setLocaleState(roleLocale);
        }
        // If a stored override exists, leave it alone — user chose it deliberately
    }, [user?.role, user?._id ?? user?.id]);

    // Public setter — updates state + persists override
    const setLocale = useCallback((next) => {
        localStorage.setItem(STORAGE_KEY, next);
        setLocaleState(next);
    }, []);

    // Toggle between the two locales
    const toggle = useCallback(() => {
        setLocale(locale === "ne" ? "en" : "ne");
    }, [locale, setLocale]);

    const value = {
        locale,           // "en" | "ne"
        isNepali: locale === "ne",
        toggle,
        setLocale,
    };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
    return ctx;
}