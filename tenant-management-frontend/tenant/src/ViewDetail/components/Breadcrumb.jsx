import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

function Breadcrumb({ tenantName }) {
  return (
    <nav
      aria-label="breadcrumb"
      className="flex items-center gap-0.5 text-xs mb-5 mt-1"
      style={{ color: "var(--color-text-weak)" }}
    >
      <Link
        to="/"
        className="hover:underline transition-colors duration-150"
        style={{ color: "inherit" }}
      >
        Dashboard
      </Link>
      <ChevronRight className="w-3 h-3 opacity-40 mx-0.5" />
      <Link
        to="/tenants"
        className="hover:underline transition-colors duration-150"
        style={{ color: "inherit" }}
      >
        Tenants
      </Link>
      {tenantName && (
        <>
          <ChevronRight className="w-3 h-3 opacity-40 mx-0.5" />
          <span
            className="truncate max-w-[160px]"
            style={{ color: "var(--color-text-body)" }}
          >
            {tenantName}
          </span>
        </>
      )}
    </nav>
  );
}

export default Breadcrumb;
