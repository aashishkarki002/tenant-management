import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

function TenantBreadcrumb({ tenantName }) {
    return (
        <Breadcrumb className="mb-3">
            <BreadcrumbList>
                <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                        <Link to="/" className="flex items-center gap-1">
                            <Home className="h-3.5 w-3.5" />
                            Home
                        </Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>

                <BreadcrumbSeparator />

                <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                        <Link to="/tenants">Tenants</Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>

                {tenantName && (
                    <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage className="max-w-[240px] truncate font-medium">
                                {tenantName}
                            </BreadcrumbPage>
                        </BreadcrumbItem>
                    </>
                )}
            </BreadcrumbList>
        </Breadcrumb>
    );
}

export default TenantBreadcrumb;
