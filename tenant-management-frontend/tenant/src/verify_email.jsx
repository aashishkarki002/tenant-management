import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import api from "../plugins/axios";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";

  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const handleResend = async () => {
    if (!email) {
      toast.error("No email address found. Please sign up again.");
      return;
    }

    setResendLoading(true);
    try {
      await api.post("/api/auth/resend-email-verification", { email });
      toast.success("Verification email sent! Check your inbox.");
      setResendSent(true);

      // 60 second cooldown to prevent spam clicking
      setCooldown(60);
      const interval = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setResendSent(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to resend. Please try again."
      );
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
            {/* Email icon */}
            <svg
              className="h-8 w-8 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <CardTitle className="text-2xl">Check your email</CardTitle>
          <CardDescription className="text-base">
            We sent a verification link to{" "}
            {email ? (
              <span className="font-medium text-foreground">{email}</span>
            ) : (
              "your email address"
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Click the link in the email to verify your account. The link
            expires in <span className="font-medium">10 minutes</span>.
          </p>

          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            Didn&apos;t receive it? Check your spam folder first.
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={handleResend}
              disabled={resendLoading || cooldown > 0}
            >
              {resendLoading ? (
                <Spinner />
              ) : cooldown > 0 ? (
                `Resend in ${cooldown}s`
              ) : (
                "Resend verification email"
              )}
            </Button>

            {resendSent && (
              <p className="text-sm text-green-600">
                ✓ New verification email sent successfully.
              </p>
            )}
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground">
              Wrong email address?{" "}
              <a
                href="/signup"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Sign up again
              </a>
            </p>
          </div>

          <div>
            <a
              href="/login"
              className="text-sm underline underline-offset-4 hover:text-foreground text-muted-foreground"
            >
              Already verified? Sign in
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}