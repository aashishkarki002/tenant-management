import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { FieldError } from "@/components/ui/field";

// Reusable field wrapper with change indicator and original-value display
function FieldWithComparison({
    label,
    name,
    type = "text",
    formik,
    originalValue,
    showComparison,
    isChanged,
    children,
    required,
}) {
    const error = formik.touched[name] && formik.errors[name];
    const hasChanged = isChanged && originalValue !== formik.values[name];

    return (
        <div
            className={cn(
                "space-y-1.5 rounded-lg p-3 transition-colors",
                hasChanged && "border border-amber-200 bg-amber-50/50"
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <Label htmlFor={name} className="text-sm font-medium">
                    {label}
                    {required && <span className="ml-0.5 text-destructive">*</span>}
                    {hasChanged && (
                        <span className="ml-2 text-xs font-normal text-amber-600">
                            Modified
                        </span>
                    )}
                </Label>

                {showComparison && hasChanged && originalValue && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                        Was:{" "}
                        <span className="font-medium">{originalValue}</span>
                    </span>
                )}
            </div>

            {children || (
                <Input
                    id={name}
                    name={name}
                    type={type}
                    value={formik.values[name]}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    aria-invalid={!!error}
                    className={cn(hasChanged && "bg-white")}
                />
            )}

            {error && <FieldError>{error}</FieldError>}
        </div>
    );
}

function TenantBasicInfo({ formik, originalTenant, showComparison, changedFields }) {
    return (
        <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <FieldWithComparison
                    label="Tenant Name"
                    name="name"
                    formik={formik}
                    originalValue={originalTenant?.name}
                    showComparison={showComparison}
                    isChanged={changedFields?.name}
                    required
                >
                    <Input
                        id="name"
                        name="name"
                        value={formik.values.name}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        maxLength={150}
                        placeholder="Enter tenant name"
                        aria-invalid={!!(formik.touched.name && formik.errors.name)}
                        className={cn(changedFields?.name && "bg-white")}
                    />
                </FieldWithComparison>

                <FieldWithComparison
                    label="Email Address"
                    name="email"
                    type="email"
                    formik={formik}
                    originalValue={originalTenant?.email}
                    showComparison={showComparison}
                    isChanged={changedFields?.email}
                    required
                >
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formik.values.email}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        maxLength={254}
                        placeholder="email@example.com"
                        autoComplete="email"
                        aria-invalid={!!(formik.touched.email && formik.errors.email)}
                        className={cn(changedFields?.email && "bg-white")}
                    />
                </FieldWithComparison>

                <FieldWithComparison
                    label="Phone Number"
                    name="phone"
                    type="tel"
                    formik={formik}
                    originalValue={originalTenant?.phone}
                    showComparison={showComparison}
                    isChanged={changedFields?.phone}
                    required
                >
                    <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={formik.values.phone}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        maxLength={20}
                        placeholder="+977 9800000000"
                        autoComplete="tel"
                        aria-invalid={!!(formik.touched.phone && formik.errors.phone)}
                        className={cn(changedFields?.phone && "bg-white")}
                    />
                </FieldWithComparison>

                <FieldWithComparison
                    label="Status"
                    name="status"
                    formik={formik}
                    originalValue={originalTenant?.status}
                    showComparison={showComparison}
                    isChanged={changedFields?.status}
                >
                    <Select
                        value={formik.values.status}
                        onValueChange={(value) => formik.setFieldValue("status", value)}
                    >
                        <SelectTrigger className={cn(changedFields?.status && "bg-white")}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="vacated">Vacated</SelectItem>
                        </SelectContent>
                    </Select>
                </FieldWithComparison>
            </div>

            {/* Address — full width */}
            <FieldWithComparison
                label="Address"
                name="address"
                formik={formik}
                originalValue={originalTenant?.address}
                showComparison={showComparison}
                isChanged={changedFields?.address}
                required
            >
                <Textarea
                    id="address"
                    name="address"
                    value={formik.values.address}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    maxLength={500}
                    rows={3}
                    placeholder="Enter full address"
                    aria-invalid={!!(formik.touched.address && formik.errors.address)}
                    className={cn(changedFields?.address && "bg-white")}
                />
            </FieldWithComparison>

            <p className="px-3 text-xs text-muted-foreground">
                Fields marked <span className="text-destructive">*</span> are required.
                Modified fields are highlighted.
            </p>
        </div>
    );
}

export default TenantBasicInfo;
