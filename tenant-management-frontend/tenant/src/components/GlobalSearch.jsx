import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../plugins/axios"; // your existing axios instance

// Badge color per result type
const TYPE_STYLES = {
    tenant: "bg-blue-100 text-blue-700",
    rent: "bg-green-100 text-green-700",
    ledger: "bg-orange-100 text-orange-700",
};

const STATUS_DOT = {
    active: "bg-green-400",
    inactive: "bg-gray-400",
    pending: "bg-yellow-400",
    paid: "bg-green-400",
    overdue: "bg-red-400",
    partially_paid: "bg-orange-400",
};

export default function GlobalSearch() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const debounceRef = useRef(null);
    const inputRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (query.length < 2) {
            setResults([]);
            setOpen(false);
            return;
        }

        // Debounce: only fire after 300ms of no typing
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const { data } = await api.get(`/search?q=${encodeURIComponent(query)}&limit=5`);
                setResults(data.results || []);
                setOpen(true);
            } catch (err) {
                console.error("Search failed:", err);
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(debounceRef.current);
    }, [query]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (inputRef.current && !inputRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (result) => {
        navigate(result.url);
        setQuery("");
        setOpen(false);
        setResults([]);
    };

    // Keyboard navigation
    const handleKeyDown = (e) => {
        if (e.key === "Escape") {
            setOpen(false);
            setQuery("");
        }
    };

    return (
        <div ref={inputRef} className="relative w-72">
            {/* Search Input */}
            <div className="relative">
                <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                    fill="none" stroke="currentColor" strokeWidth={2}
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round"
                        d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>

                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search tenants, rents, ledger…"
                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg
                     bg-gray-50 focus:bg-white focus:outline-none focus:ring-2
                     focus:ring-blue-500 focus:border-transparent transition-all"
                />

                {/* Clear button */}
                {query && (
                    <button
                        onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Dropdown Results */}
            {open && (
                <div className="absolute top-full mt-1 w-full min-w-[320px] bg-white border
                        border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">

                    {/* Loading State */}
                    {loading && (
                        <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-400">
                            <span className="animate-spin">⏳</span> Searching…
                        </div>
                    )}

                    {/* Empty State */}
                    {!loading && results.length === 0 && query.length >= 2 && (
                        <div className="px-4 py-4 text-sm text-gray-400 text-center">
                            No results for <strong>"{query}"</strong>
                        </div>
                    )}

                    {/* Results */}
                    {!loading && results.length > 0 && (
                        <>
                            {/* Group by type */}
                            {["tenant", "rent", "ledger"].map((type) => {
                                const group = results.filter((r) => r.type === type);
                                if (!group.length) return null;

                                const groupLabel = { tenant: "Tenants", rent: "Rents", ledger: "Ledger" }[type];

                                return (
                                    <div key={type}>
                                        {/* Group header */}
                                        <p className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                            {groupLabel}
                                        </p>

                                        {group.map((result) => (
                                            <div
                                                key={`${result.type}-${result._id}`}
                                                onClick={() => handleSelect(result)}
                                                className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50
                                   cursor-pointer transition-colors border-b border-gray-50 last:border-0"
                                            >
                                                {/* Type badge */}
                                                <span className={`mt-0.5 shrink-0 text-xs font-medium px-1.5 py-0.5
                                         rounded-md ${TYPE_STYLES[result.type]}`}>
                                                    {result.type}
                                                </span>

                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-800 truncate">
                                                        {result.label}
                                                    </p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        {/* Status dot */}
                                                        {result.badge && (
                                                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[result.badge] ?? "bg-gray-400"}`} />
                                                        )}
                                                        <p className="text-xs text-gray-500 truncate">{result.sublabel}</p>
                                                        {result.meta && (
                                                            <span className="text-xs text-gray-400 shrink-0">· {result.meta}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}

                            {/* Footer hint */}
                            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                                <p className="text-xs text-gray-400">
                                    Press <kbd className="bg-white border rounded px-1">Esc</kbd> to close
                                </p>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}