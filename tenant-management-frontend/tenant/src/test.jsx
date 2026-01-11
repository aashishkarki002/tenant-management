import React from "react";
import { Formik, Form, Field } from "formik";
import DualCalendarTailwind from "./components/dualDate";

export default function TestFormik() {
  return (
    <div className="p-4 max-w-md mx-auto">
      <Formik
        initialValues={{ date: "" }}
        onSubmit={(values) => {
          console.log("Form submitted:", values);
          alert(`Selected Date: ${values.date}`);
        }}
      >
        {({ values, setFieldValue }) => (
          <Form className="">
            <label htmlFor="date" className="font-medium">
              Date
            </label>

            {/* Dual Calendar */}
            <DualCalendarTailwind
              onChange={(english, nepali) =>
                setFieldValue("date", `${english} / ${nepali}`)
              }
            />

            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
            >
              Submit
            </button>

            <p className="mt-2 text-gray-700">Current Value: {values.date}</p>
          </Form>
        )}
      </Formik>
    </div>
  );
}
