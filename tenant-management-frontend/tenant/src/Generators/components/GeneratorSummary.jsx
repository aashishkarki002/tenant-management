/**
 * GeneratorSummary
 *
 * Props:
 *   generators  {Array}  — full list of generator documents
 */
export function GeneratorSummary({ generators }) {
    const total = generators.length;
    const faultCount = generators.filter(g => g.status === "FAULT").length;
    const maintCount = generators.filter(g => g.status === "MAINTENANCE").length;
    const today = new Date().toDateString();
    const checkedToday = generators.filter(
        g => g.lastCheckedAt && new Date(g.lastCheckedAt).toDateString() === today
    ).length;

    const tiles = [
        { label: "Total", value: total, color: "text-gray-800", bg: "bg-gray-50 border-gray-200" },
        { label: "Checked Today", value: checkedToday, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
        { label: "Fault", value: faultCount, color: "text-red-700", bg: "bg-red-50 border-red-200" },
        { label: "Maintenance", value: maintCount, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
    ];

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {tiles.map(({ label, value, color, bg }) => (
                <div key={label} className={`${bg} border rounded-xl px-4 py-3 flex flex-col`}>
                    <span className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">{label}</span>
                    <span className={`text-2xl font-bold mt-1 ${color}`}>{value}</span>
                </div>
            ))}
        </div>
    );
}
