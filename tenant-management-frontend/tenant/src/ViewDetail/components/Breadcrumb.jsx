import { Link } from "react-router-dom";
import { ChevronRight, LayoutDashboard } from "lucide-react";

function Breadcrumb({ tenantName }) {
  return (
    <nav aria-label="breadcrumb" className="flex items-center mt-1 text-xs text-muted-foreground mb-4">
      <Link
        to="/"
        className="flex items-center gap-1 hover:text-foreground transition-colors duration-150 cursor-pointer"
      >
        <LayoutDashboard className="w-3.5 h-3.5" />
        <span>Dashboard</span>
      </Link>

      <ChevronRight className="w-3 h-3 opacity-40" />

      <Link
        to="/tenants"
        className="hover:text-foreground transition-colors duration-150 cursor-pointer"
      >
        Tenants
      </Link>

      {tenantName && (
        <>
          <ChevronRight className="w-3 h-3 opacity-40" />
          <span className="font-medium text-foreground truncate max-w-[160px]">
            {tenantName}
          </span>
        </>
      )}
    </nav>
  );
}

export default Breadcrumb;
