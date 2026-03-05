// src/context/HeaderSlotContext.jsx
import { createContext, useContext, useLayoutEffect, useState } from "react";

const HeaderSlotContext = createContext(null);

export function HeaderSlotProvider({ children }) {
    const [slotContent, setSlotContent] = useState(null);
    return (
        <HeaderSlotContext.Provider value={{ slotContent, setSlotContent }}>
            {children}
        </HeaderSlotContext.Provider>
    );
}

/** Renders injected slot content, or `fallback` when the slot is empty. */
export function HeaderSlot({ fallback = null }) {
    const ctx = useContext(HeaderSlotContext);
    if (!ctx) return fallback;
    return <>{ctx.slotContent ?? fallback}</>;
}

/**
 * Inject content into the Header slot from any page.
 * Auto-clears on unmount — no stale CTAs when navigating away.
 * Uses useLayoutEffect so content appears before first paint (no flicker).
 */
export function useHeaderSlot(content) {
    const ctx = useContext(HeaderSlotContext);
    useLayoutEffect(() => {
        if (!ctx) return;
        ctx.setSlotContent(content);
        return () => ctx.setSlotContent(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [content]);
}