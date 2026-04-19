import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useFormik } from "formik";
import api from "../../plugins/axios";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Eye, EyeOff } from "lucide-react";

export default function LoginForm({ className, ...props }) {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { fetchMe } = useAuth();

  const formik = useFormik({
    initialValues: {
      email: "",
      password: "",
    },
    onSubmit: async (values) => {
      setLoading(true);
      try {
        const response = await api.post("/api/auth/login", {
          email: values.email,
          password: values.password,
        });

        const data = response.data;

        if (data.success) {
          await fetchMe(true);
          navigate("/");
        } else {
          toast.error(data.message);
        }
      } catch (error) {
        console.error("Login error:", error);
        const errorMessage =
          error.response?.data?.message || "Login failed. Please try again.";
        toast.error(errorMessage);
      }
      setLoading(false);
    },
  });

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={formik.handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  formik={formik}
                  onChange={formik.handleChange}
                  value={formik.values.email}
                  name="email"
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <a
                    href="/forget-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    formik={formik}
                    onChange={formik.handleChange}
                    value={formik.values.password}
                    name="password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </Field>
              <Field>
                <Button type="submit">{loading ? <Spinner /> : "Login"}</Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}