  import React from 'react';
  import { cn } from "@/lib/utils"
  import { Button } from "@/components/ui/button"
  import { Card, CardContent } from "@/components/ui/card"
  import { ClipboardListIcon } from 'lucide-react';
  import { XIcon } from 'lucide-react';
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
  import { FileIcon } from 'lucide-react';

  import { useFormik } from 'formik';

  import {
      Field,
      FieldDescription,
      FieldGroup,
      FieldLabel,
      FieldSeparator,
    } from "@/components/ui/field"
    import { Input } from "@/components/ui/input"
    import { Label } from "@/components/ui/label"
    import { ImageIcon } from 'lucide-react';

  export default function AddTenants() {
      const formik = useFormik({
          initialValues: {
            name: '',
            unitNumber: '',
            phone: '',
            email: '',
            image: '',
            pdfAgreement: '',
          },
        });
        const handleSubmit = (values) => {
          console.log(values);
        };
        function handleClose() {
          navigate('/tenants');
        }
      return (
        
          <div className="">
            <div>
            <Button variant="outline" className='w-10 h-10 rounded-full right-0 absolute' onClick={handleClose} ><XIcon className="w-5 h-5 text-black  " /></Button>
            </div>
         
          <div className="h-250 w-full border-2 rounded-md  ">
          
            <form className="flex  gap-10 ml-4 align-middle">
              
              <div className='flex-2'>
          
            
                <FieldGroup>
                  <div className="flex flex-col ">
                    <div className='flex items-center justify-between mt-4'>
                   
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                    <ClipboardListIcon className="w-5 h-5 text-black  " /> 
                      New Tenant Registration</h1>
                    
                      </div>
                      
                  </div>
                  <Field className="w-full">

                    <FieldLabel htmlFor="name">Full Name</FieldLabel>
                    <Input id="name" className="w-50" type="text" placeholder="John Doe" required formik={formik} onChange={formik.handleChange} value={formik.values.name} name="name" />
                  </Field>
                  <div className="flex justify-between gap-4">
                  <Field className="w-full">
                    <FieldLabel htmlFor="unitNumber">Unit Number</FieldLabel>
                    <Input id="unitNumber" className="w-full" type="text" placeholder="A-101" required formik={formik} onChange={formik.handleChange} value={formik.values.unitNumber} name="unitNumber" />
                  </Field>
                  <Field className="w-full">
                    <FieldLabel htmlFor="phone">Contact Number</FieldLabel>
                    <Input id="phone" type="tel" placeholder="+977-9800000000" required formik={formik} onChange={formik.handleChange} value={formik.values.phone} name="phone" />
                  
                  </Field> </div>
                 
                  
                  <div className="flex justify-between gap-4">
                      <Field className=" w-full ">
                        <FieldLabel htmlFor="email">Email</FieldLabel>
                        <Input id="email" type="email" placeholder="john.doe@example.com" required formik={formik} onChange={formik.handleChange} value={formik.values.email} name="email" />
                      </Field>
                      <Field className="w-full">
                        <FieldLabel htmlFor="leaseStart">Lease Start</FieldLabel>
                        <Input id="leaseStart" type="date" placeholder="2025-12-21" required formik={formik} onChange={formik.handleChange} value={formik.values.leaseStart} name="leaseStart" />
                      </Field>
                    
                  
                  </div>
                  <Field className="w-full">
                    <FieldLabel htmlFor="leaseEnd">Lease End</FieldLabel>
                    <Input id="leaseEnd" type="date" placeholder="2025-12-18" required formik={formik} onChange={formik.handleChange} value={formik.values.leaseEnd} name="leaseEnd" />
                  </Field>
                  <div>
                   <p>Property Details</p>
                   <div className='flex justify-between gap-4'>
                   <div>
                   <p>Property</p>
                   <Select classname="w-50">
                    <SelectTrigger>
                      <SelectValue placeholder="Select Property" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Property 1">Property 1</SelectItem>
                    </SelectContent>
                   </Select></div>
                   <div><p>Block</p>
                   <Select classname="w-50">
                    <SelectTrigger>
                      <SelectValue placeholder="Select Block" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Block 1">Block 1</SelectItem>
                    </SelectContent>
                   </Select></div>
                   <div><p>Inner Block</p>
                   <Select classname="w-50">
                    <SelectTrigger>
                      <SelectValue placeholder="Select Inner Block" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Inner Block 1">Inner Block 1</SelectItem>
                    </SelectContent>
                   </Select></div>
                  </div></div>
                  <div className='flex  gap-4'><div><p>Address</p>
                  <Input id="address" type="text" className='w-95' placeholder="123 Main St, Anytown, USA" required formik={formik} onChange={formik.handleChange} value={formik.values.address} name="address" />
                  </div>
                  <div><p>Key Handover Date</p>
                  <Input id="keyHandoverDate" type="date" className='w-95' placeholder="2025-12-21" required formik={formik} onChange={formik.handleChange} value={formik.values.keyHandoverDate} name="keyHandoverDate" />
                  </div>
                  </div>
                  <div className='flex justify-between gap-4'>
                  <div><p>Documents</p>
                  <Label htmlFor="image" className="text-sm font-medium text-slate-700">
                        Image (Optional)
                      </Label>
                      <label
                        htmlFor="image"
                        className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-slate-300 px-4 py-3 hover:border-blue-400 transition-colors w-95"
                      >
                        <ImageIcon className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-500 ">
                          {formik.values.image ? formik.values.image.name : "Upload Image"}
                        </span>
                        </label>

                  </div>
                  <div classname="mt-2"> <p>PDF Agreement</p>
                  <label htmlFor="pdfAgreement" className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-slate-300 px-4 py-3 hover:border-blue-400 transition-colors w-95">
                    <FileIcon className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-500 ">
                      {formik.values.pdfAgreement ? formik.values.pdfAgreement.name : "Upload PDF Agreement"}
                    </span>
                  </label>
                  </div>
                  </div>
                  <div><p className='mt-2 mb-2' >Agreement Signed Date</p>
                  <Input id="agreementSignedDate" type="date" className='w-full' placeholder="2025-12-21" required formik={formik} onChange={formik.handleChange} value={formik.values.agreementSignedDate} name="agreementSignedDate" />
                  </div>
                  <div className='flex justify-between gap-4'><div><Button type="button" variant="secondary" className='bg-gray-50 text-black mr-2 w-95 hover:bg-gray-200'>Cancel</Button></div>
                  <div><Button className='bg-blue-600 text-blue-50 mr-2 w-95 hover:bg-blue-800'>Save & Register</Button></div>
                  </div>
                </FieldGroup>

    
              
              </div>
            <div className='flex-1'> 
              <Card className="w-full   h-200 mt-22 ">
                  <CardContent>
                    <h1 className='text-xl font-bold'>Rent & Financials</h1>
                    <div className='flex flex-col gap-2'>
                    <p className='text-gray-500 text-sm'>PropertySize(sqm)</p>
                    <Input id="propertySize" type="number" className='w-full h-12'
                    placeholder="100" required formik={formik} onChange={formik.handleChange} value={formik.values.propertySize} name="propertySize" />
                    <p>Security Deposit(₹)</p>
                    <Input id="securityDeposit" type="number" className='w-full h-12' placeholder="₹ 0" required formik={formik} onChange={formik.handleChange} value={formik.values.securityDeposit} name="securityDeposit" />
                    <div className='flex justify-between text-gray-500 text-sm'><p>Base Rent:</p>
                    <p>₹ 80000</p></div>
                    <div className='flex justify-between text-gray-500 text-sm'><p>Tax(10%):</p>
                    <p>₹ 8000</p></div>
                    <div className='flex justify-between'><p className='font-bold text-sm'>Total Monthly Rent:</p>
                    <p>₹ 88000</p></div>
                    </div>
                    <div><p>Status</p>
                    <Select classname="w-50">
                    <SelectTrigger>
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                    </SelectContent>
                   </Select>
                    </div>


                  
                  </CardContent>
                  </Card></div>
            
              <div>
              
                  </div>
                  </form>
                </div>
                </div>

      );
  }
