import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useFormik } from "formik";
import * as Yup from "yup";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
// FIX: Use the configured api instance, not raw axios.
// Raw axios bypasses all interceptors and uses a hardcoded localhost URL.
import api from "../../plugins/axios";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const validationSchema = Yup.object({
  name: Yup.string().required("Name is required"),
  phone: Yup.string().required("Phone is required"),
  email: Yup.string().email("Invalid email address").required("Email is required"),
  password: Yup.string()
    .min(8, "Password must be at least 8 characters")
    .required("Password is required"),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("password")], "Passwords do not match")
    .required("Please confirm your password"),
});

export default function SignupForm({ className, ...props }) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const formik = useFormik({
    initialValues: {
      name: "",
      phone: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    validationSchema,
    onSubmit: async (values) => {
      setIsLoading(true);
      try {
        const response = await api.post("/api/auth/register", {
          name: values.name,
          email: values.email,
          password: values.password,
          phone: values.phone,
        });

        if (response.data.success) {
          toast.success("Account created! Please check your email to verify your account.");
          // Pass email to verify-email page so it can offer resend
          navigate("/verify-email?email=" + encodeURIComponent(values.email));
        } else {
          toast.error(response.data?.message || "Registration failed");
        }
      } catch (error) {
        toast.error(
          error.response?.data?.message || "An error occurred during registration"
        );
        console.error("Signup error:", error);
      } finally {
        // FIX: Always runs, even if an unexpected error bypasses catch.
        // Previously setIsLoading(false) was duplicated in both success and catch paths.
        setIsLoading(false);
      }
    },
  });

  return (
    <div className={cn("flex flex-col gap-6 p-15", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8" onSubmit={formik.handleSubmit}>
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">Create your account</h1>
                <p className="text-muted-foreground text-sm text-balance">
                  Enter your details below to create your account
                </p>
              </div>

              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  required
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  value={formik.values.name}
                  name="name"
                />
                {formik.errors.name && formik.touched.name && (
                  <div className="text-sm text-red-500 mt-1">{formik.errors.name}</div>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="phone">Phone</FieldLabel>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="1234567890"
                  required
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  value={formik.values.phone}
                  name="phone"
                />
                {formik.errors.phone && formik.touched.phone && (
                  <div className="text-sm text-red-500 mt-1">{formik.errors.phone}</div>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  value={formik.values.email}
                  name="email"
                />
                {formik.errors.email && formik.touched.email && (
                  <div className="text-sm text-red-500 mt-1">{formik.errors.email}</div>
                )}
                <FieldDescription>
                  We&apos;ll use this to contact you. We will not share your
                  email with anyone else.
                </FieldDescription>
              </Field>

              <Field className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    required
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    value={formik.values.password}
                    name="password"
                  />
                  {formik.errors.password && formik.touched.password && (
                    <div className="text-sm text-red-500 mt-1">
                      {formik.errors.password}
                    </div>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
                  <Input
                    id="confirm-password"
                    type="password"
                    required
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    value={formik.values.confirmPassword}
                    name="confirmPassword"
                  />
                  {formik.errors.confirmPassword && formik.touched.confirmPassword && (
                    <div className="text-sm text-red-500 mt-1">
                      {formik.errors.confirmPassword}
                    </div>
                  )}
                </Field>
              </Field>
              <FieldDescription>Must be at least 8 characters long.</FieldDescription>

              <Field>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? <Spinner /> : "Create Account"}
                </Button>
              </Field>

              <FieldDescription className="text-center">
                Already have an account? <a href="/login">Sign in</a>
              </FieldDescription>
            </FieldGroup>
          </form>

          <div className="bg-muted relative hidden md:block">
            <img
              src="/digi.jpg"
              alt="Image"
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
            />
          </div>
        </CardContent>
      </Card>

      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our{" "}
        <a href="/terms-of-service">Terms of Service</a> and{" "}
        <a href="/privacy-policy">Privacy Policy</a>
      </FieldDescription>
    </div>
  );
}