import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Toaster } from "@/components/ui/sonner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"


export default function LoginForm({
  className,
  ...props
})


 {
  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
  });
  const handleSubmit = (values) => {
    console.log(values);
  };
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props} onSubmit={formik.handleSubmit} >
      
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formik.handleSubmit} >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" type="email" placeholder="m@example.com" required formik={formik} onChange={formik.handleChange} value={formik.values.email} name="email"  />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <a
                    href="#"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline">
                    Forgot your password?
                  </a>
                </div>
                <Input id="password" type="password" required formik={formik} onChange={formik.handleChange} value={formik.values.password} />
              </Field>
              <Field>
              <Toaster />
                <Button type="submit"  onClick={() => toast("Event has been created")}  onSubmit={formik.handleSubmit} >Login</Button>
                <Button variant="outline" type="button">
                  Login with Google
                </Button>
                <FieldDescription className="text-center">
                  Don&apos;t have an account? <a href="#">Sign up</a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
