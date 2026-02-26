export function Pill({ children, className = "" }) {
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${className}`}>
            {children}
        </span>
    );
}