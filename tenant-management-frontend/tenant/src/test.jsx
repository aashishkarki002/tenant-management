import React from "react";
import { Formik, Form, Field } from "formik";
import DualCalendarTailwind from "./components/dualDate";
import {Input } from "./components/ui/input"
import {Button } from "./components/ui/button"
import { useState } from "react";
import { useFormik } from "formik";
export default function TestFormik() {
const formik = useFormik({
  initialValues: {
    email: "test@test.com",
    password: "",
  },
  onSubmit:(values)=>{
    console.log(values)
  }
});
  return (
<>
<h2>hello</h2>
<form action="" onSubmit={formik.handleSubmit}>
<label htmlFor="email">Email</label>
<Input type="email" name="email" value={formik.values.email} onChange={formik.handleChange}  />
<label htmlFor="password">password</label>
<Input type="password" name="password" value={formik.values.password} onChange={formik.handleChange} />
<Button type="submit">Submit</Button>
</form>
</>
  );
}
