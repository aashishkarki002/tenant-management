// src/context/HeaderSlotContext.jsx
import { createContext, useContext, useLayoutEffect, useRef, useState } from "react";

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
 *
 * Industry note: passing JSX directly as `content` is a new reference every
 * render → infinite loop with [content] in deps. We store in a ref and only
 * call setSlotContent when the rendered output actually changes (via a
 * render-prop / factory function). Pages should wrap their slot JSX in
 * useMemo() with explicit deps so the factory only fires on real changes.
 *
 * Auto-clears on unmount — no stale CTAs when navigating away.
 * Uses useLayoutEffect so content appears before first paint (no flicker).
 */
export function useHeaderSlot(contentFactory, deps) {
    const ctx = useContext(HeaderSlotContext);
    const factoryRef = useRef(contentFactory);
    factoryRef.current = contentFactory;

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useLayoutEffect(() => {
        if (!ctx) return;
        ctx.setSlotContent(factoryRef.current());
        return () => ctx.setSlotContent(null);
    }, deps); // deps are caller-controlled — same contract as useEffect
}