import { useEffect, useState, useRef, useCallback } from "react";
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
    UserPlus,
    Wrench,
    Search,
    X,
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

const QUICK_ACTIONS = [
    { label: "Go to Dashboard", icon: LayoutDashboard, route: "/dashboard" },
    { label: "Add New Tenant", icon: UserPlus, route: "/tenant/addTenants" },
    { label: "Record Payment", icon: Receipt, route: "/rent-payment" },
    { label: "Log Maintenance", icon: Wrench, route: "/maintenance" },
];

export default function GlobalSearch() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [recent, setRecent] = useState(() => {
        try {
            const stored = localStorage.getItem("recent-searches");
            return stored ? JSON.parse(stored) : [];
        } catch (err) {
            console.error("Failed to parse recent searches:", err);
            return [];
        }
    });
    const debounceRef = useRef(null);
    const navigate = useNavigate();

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

    useEffect(() => {
        if (!query || query.trim().length < 2) {
            setResults([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        clearTimeout(debounceRef.current);
        
        debounceRef.current = setTimeout(async () => {
            try {
                const { data } = await api.get("/api/search", {
                    params: { q: query.trim(), limit: 10 }
                });
                
                console.log("Search API response:", data);
                console.log("Results:", data?.results);
                console.log("Is array?", Array.isArray(data?.results));
                
                if (data.success && Array.isArray(data.results)) {
                    console.log("Setting results:", data.results);
                    setResults(data.results);
                } else {
                    console.log("No valid results, data:", data);
                    setResults([]);
                }
            } catch (err) {
                console.error("Search error:", err);
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [query]);

    const saveRecent = useCallback((item) => {
        try {
            const updated = [
                item,
                ...recent.filter((r) => r._id !== item._id)
            ].slice(0, 5);
            setRecent(updated);
            localStorage.setItem("recent-searches", JSON.stringify(updated));
        } catch (err) {
            console.error("Failed to save recent search:", err);
        }
    }, [recent]);

    const handleSelect = useCallback((item) => {
        if (item.url) {
            saveRecent(item);
            navigate(item.url);
            setOpen(false);
            setQuery("");
        }
    }, [navigate, saveRecent]);

    const handleQuickAction = useCallback((route) => {
        navigate(route);
        setOpen(false);
        setQuery("");
    }, [navigate]);

    const grouped = {
        tenant: results.filter((r) => r.type === "tenant"),
        rent: results.filter((r) => r.type === "rent"),
        ledger: results.filter((r) => r.type === "ledger"),
    };

    const hasResults = results.length > 0;
    const showEmpty = query && !loading && !hasResults;
    
    console.log("Render state:", { 
        query, 
        loading, 
        hasResults, 
        showEmpty, 
        resultsCount: results.length,
        grouped 
    });

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="w-full max-w-xs flex items-center justify-between px-3 py-2 text-sm 
                    border rounded-xl bg-muted hover:bg-muted/70 transition-all duration-150
                    focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
                <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Search anything…</span>
                </div>
                <kbd className="hidden sm:inline-flex text-xs bg-background border px-1.5 py-0.5 rounded-md">
                    ⌘K
                </kbd>
            </button>

            <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
                <div className="flex items-center border-b px-3">
                    <Search className="w-4 h-4 mr-2 shrink-0 text-muted-foreground" />
                    <CommandInput
                        placeholder="Search tenants, rents, ledger entries..."
                        value={query}
                        onValueChange={setQuery}
                        className="border-0 focus:ring-0 py-3"
                    />
                    {query && (
                        <button 
                            onClick={() => setQuery("")}
                            className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <CommandList className="max-h-96">
                    {loading && (
                        <div className="flex items-center justify-center py-8">
                            <div className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                        </div>
                    )}

                    {showEmpty && (
                        <CommandEmpty>
                            No results found for &quot;{query}&quot;
                        </CommandEmpty>
                    )}

                    {!query && (
                        <>
                            <CommandGroup heading="Quick Actions">
                                {QUICK_ACTIONS.map((action) => (
                                    <CommandItem
                                        key={action.route}
                                        onSelect={() => handleQuickAction(action.route)}
                                        className="cursor-pointer"
                                    >
                                        <action.icon className="w-4 h-4 mr-2 text-muted-foreground" />
                                        {action.label}
                                    </CommandItem>
                                ))}
                            </CommandGroup>

                            {recent.length > 0 && (
                                <>
                                    <CommandSeparator />
                                    <CommandGroup heading="Recent Searches">
                                        {recent.map((item) => {
                                            const Icon = TYPE_ICON[item.type] || Clock;
                                            return (
                                                <CommandItem
                                                    key={item._id}
                                                    onSelect={() => handleSelect(item)}
                                                    className="cursor-pointer"
                                                >
                                                    <Icon className="w-4 h-4 mr-2 text-muted-foreground" />
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <span className="text-sm truncate">{item.label}</span>
                                                        {item.sublabel && (
                                                            <span className="text-xs text-muted-foreground truncate">
                                                                {item.sublabel}
                                                            </span>
                                                        )}
                                                    </div>
                                                </CommandItem>
                                            );
                                        })}
                                    </CommandGroup>
                                </>
                            )}
                        </>
                    )}

                    {!loading && hasResults && (
                        <>
                            {Object.entries(grouped).map(([type, items]) => {
                                if (!items.length) return null;

                                const typeLabel = type.charAt(0).toUpperCase() + type.slice(1) + "s";

                                return (
                                    <CommandGroup key={type} heading={typeLabel}>
                                        {items.map((item) => {
                                            const Icon = TYPE_ICON[type] || BookOpen;

                                            return (
                                                <CommandItem
                                                    key={item._id}
                                                    onSelect={() => handleSelect(item)}
                                                    className="cursor-pointer"
                                                >
                                                    <Icon className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />

                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <span className="text-sm font-medium truncate">
                                                            {item.label}
                                                        </span>

                                                        {item.sublabel && (
                                                            <span className="text-xs text-muted-foreground truncate">
                                                                {item.sublabel}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {item.badge && (
                                                        <div className="flex items-center gap-1.5 ml-2 shrink-0">
                                                            <span className={`w-2 h-2 rounded-full ${STATUS_DOT[item.badge] || "bg-gray-400"}`} />
                                                        </div>
                                                    )}
                                                </CommandItem>
                                            );
                                        })}
                                    </CommandGroup>
                                );
                            })}
                        </>
                    )}
                </CommandList>
            </CommandDialog>
        </>
    );
}