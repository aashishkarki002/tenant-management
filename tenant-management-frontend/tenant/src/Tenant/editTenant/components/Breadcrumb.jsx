import { Link } from "react-router-dom";
import { Home, ChevronRight } from "lucide-react";

function Breadcrumb({ tenantName }) {
    return (
        <nav aria-label="breadcrumb" className="flex items-center text-sm text-gray-500 mb-3">
            {/* Home */}
            <Link to="/" className="flex items-center hover:text-gray-700">
                <Home className="w-4 h-4 mr-1" />
                Home
            </Link>

            {/* Separator */}
            <ChevronRight className="w-3 h-3 mx-1" />

            {/* Tenants */}
            <Link to="/tenants" className="hover:text-gray-700">
                Tenants
            </Link>

            {/* Tenant Name */}
            {tenantName && (
                <>
                    <ChevronRight className="w-3 h-3 mx-1" />
                    <span className="font-medium text-gray-800 truncate max-w-[150px]">
                        {tenantName}
                    </span>
                </>
            )}
        </nav>
    );
}

export default Breadcrumb;