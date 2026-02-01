import React from "react";
import useUnits from "./hooks/use-units";
import useProperty from "./hooks/use-property";
export default function TestFormik() {

  const { units } = useUnits();
  console.log(units);
  const { property, block, innerBlock } = useProperty();
  console.log(property);
  console.log(block);
  console.log(innerBlock);
  return <div>TestFormik</div>;
}
