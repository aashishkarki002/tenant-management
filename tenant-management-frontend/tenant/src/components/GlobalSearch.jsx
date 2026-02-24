import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../plugins/axios";

import {
    CommandDialog,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandSeparator,
} from "@/components/ui/command";

import {
    Users,
    Receipt,
    BookOpen,
    LayoutDashboard,
    PlusCircle,
    Clock,
} from "lucide-react";

const TYPE_ICON = {
    tenant: Users,
    rent: Receipt,
    ledger: BookOpen,
};

const STATUS_DOT = {
    active: "bg-green-500",
    inactive: "bg-gray-400",
    pending: "bg-yellow-400",
    paid: "bg-green-500",
    overdue: "bg-red-500",
    partially_paid: "bg-orange-400",
};

export default function GlobalSearch() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [recent, setRecent] = useState([]);
    const debounceRef = useRef(null);
    const navigate = useNavigate();

    // ⌘K shortcut
    useEffect(() => {
        const down = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setOpen((prev) => !prev);
            }
        };
        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    // Load recent searches
    useEffect(() => {
        const stored = localStorage.getItem("recent-searches");
        if (stored) setRecent(JSON.parse(stored));
    }, []);

    const saveRecent = (item) => {
        const updated = [item, ...recent.filter((r) => r._id !== item._id)].slice(0, 5);
        setRecent(updated);
        localStorage.setItem("recent-searches", JSON.stringify(updated));
    };

    // API Search
    useEffect(() => {
        if (query.length < 2) {
            setResults([]);
            return;
        }

        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const { data } = await api.get(
                    `/search?q=${encodeURIComponent(query)}&limit=6`
                );
                setResults(data.results || []);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(debounceRef.current);
    }, [query]);

    const handleSelect = (item) => {
        saveRecent(item);
        navigate(item.url);
        setOpen(false);
        setQuery("");
    };

    const grouped = {
        tenant: results.filter((r) => r.type === "tenant"),
        rent: results.filter((r) => r.type === "rent"),
        ledger: results.filter((r) => r.type === "ledger"),
    };

    return (
        <>
            {/* Trigger */}
            <button
                onClick={() => setOpen(true)}
                className="w-72 flex items-center justify-between px-3 py-2 text-sm 
        border rounded-xl bg-muted hover:bg-muted/70 transition"
            >
                <span className="text-muted-foreground">
                    Search anything…
                </span>
                <kbd className="text-xs bg-background border px-1.5 py-0.5 rounded-md">
                    ⌘K
                </kbd>
            </button>

            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput
                    placeholder="Search tenants, rents, ledger..."
                    value={query}
                    onValueChange={setQuery}
                />

                <CommandList>
                    {loading && (
                        <div className="px-4 py-2 text-sm text-muted-foreground">
                            Searching...
                        </div>
                    )}

                    {/* Quick Actions */}
                    {!query && (
                        <>
                            <CommandGroup heading="Quick Actions">
                                <CommandItem onSelect={() => navigate("/dashboard")}>
                                    <LayoutDashboard className="w-4 h-4 mr-2" />
                                    Go to Dashboard
                                </CommandItem>

                                <CommandItem onSelect={() => navigate("/tenants/create")}>
                                    <PlusCircle className="w-4 h-4 mr-2" />
                                    Add New Tenant
                                </CommandItem>
                            </CommandGroup>

                            {recent.length > 0 && (
                                <>
                                    <CommandSeparator />
                                    <CommandGroup heading="Recent">
                                        {recent.map((item) => {
                                            const Icon = TYPE_ICON[item.type] || Clock;
                                            return (
                                                <CommandItem
                                                    key={item._id}
                                                    onSelect={() => handleSelect(item)}
                                                >
                                                    <Icon className="w-4 h-4 mr-2 text-muted-foreground" />
                                                    {item.label}
                                                </CommandItem>
                                            );
                                        })}
                                    </CommandGroup>
                                </>
                            )}
                        </>
                    )}

                    {/* Search Results */}
                    {query && !loading && results.length === 0 && (
                        <CommandEmpty>No results found.</CommandEmpty>
                    )}

                    {Object.entries(grouped).map(([type, items]) => {
                        if (!items.length) return null;

                        return (
                            <CommandGroup key={type} heading={type.toUpperCase()}>
                                {items.map((item) => {
                                    const Icon = TYPE_ICON[type] || BookOpen;

                                    return (
                                        <CommandItem
                                            key={item._id}
                                            onSelect={() => handleSelect(item)}
                                        >
                                            <Icon className="w-4 h-4 mr-2 text-muted-foreground" />

                                            <div className="flex flex-col flex-1">
                                                <span className="text-sm font-medium">
                                                    {item.label}
                                                </span>

                                                {item.sublabel && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {item.sublabel}
                                                    </span>
                                                )}
                                            </div>

                                            {item.badge && (
                                                <span
                                                    className={`w-2 h-2 rounded-full ml-2 ${STATUS_DOT[item.badge]}`}
                                                />
                                            )}
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        );
                    })}
                </CommandList>
            </CommandDialog>
        </>
    );
}