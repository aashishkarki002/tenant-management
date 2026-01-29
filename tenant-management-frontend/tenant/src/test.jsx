import React from "react";
import DualCalendarTailwind from "./components/dualDate";
import { useFormik } from "formik";
export default function TestFormik() {
  const formik = useFormik({
    initialValues: {
      email: "test@test.com",
      password: "",
    },
    onSubmit: (values) => {
      console.log(values)
    }
  });
  return (
    <>
      <h2>hello</h2>
      <DualCalendarTailwind />

    </>
  );
}
