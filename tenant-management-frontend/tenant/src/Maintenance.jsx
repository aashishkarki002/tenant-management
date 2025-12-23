import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Calendar } from 'lucide-react';
import{List} from 'lucide-react';
import{Filter} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import{Clock} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
export default function Maintenance() {

    return (
<>
        <div className='flex justify-between'>
            <div>
            <h1 className='text-2xl font-bold'>Maintenance</h1>
            <p className='text-gray-500 text-sm'>Schedule repairs and manage tasks</p></div>
            <div>
            <Dialog>
      <DialogTrigger asChild>
      <Button className='bg-blue-600 text-blue-50 mr-2 w-45 mt-2 p-2 rounded-md hover:bg-blue-800 '><Plus className="w-5 h-5 text-blue-50 " />Schedule Repair</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Repair</DialogTitle>
          <DialogDescription>
           Issue Title
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="link" className="sr-only">
              Link
            </Label>
            <Input
              id="link"
              placeholder='Broken Ac'
            />
          </div>
        </div>
        <div className='flex justify-between'><div><p>Unit/Location</p>
        <Input
              id="link"
              placeholder='Unit 101'
            /></div>
            <div><p>Date</p>
            <Input
              id="link"
              placeholder='2025-12-18'
            />
        </div></div>
        <div className='flex justify-between'>
            <div><p>Type</p>
            <Select classname="w-50">
            <SelectTrigger classname="w-50">
            <SelectValue placeholder='Select Type' />
            </SelectTrigger>
            <SelectContent classname="w-50">
            <SelectItem value='Repair'>Repair</SelectItem>
            <SelectItem value='Maintenance'>Maintenance</SelectItem>
            </SelectContent>
            </Select>
            </div>
        <div><p>Priority</p>
        <Select classname="w-50">
        <SelectTrigger classname="w-50">
        <SelectValue placeholder='Select Priority' />
        </SelectTrigger>
        <SelectContent classname="w-50">
        <SelectItem value='Low'>Low</SelectItem>
        <SelectItem value='Medium'>Medium</SelectItem>
        <SelectItem value='High'>High</SelectItem>
        </SelectContent>
        </Select>
        </div>
    

        </div>
        <div><p>Description</p>
        <Textarea className='w-full h-12'
        placeholder='Enter Description'
        />
        </div>

        <DialogFooter className="sm:justify-start">
          <DialogClose asChild>
            <div className='flex justify-between'>
            <Button type="button" variant="secondary" className='bg-gray-50 text-black mr-2 w-50 hover:bg-gray-200'> 
              Cancel
            </Button>
            <Button type="button" variant="default" className='bg-blue-600 text-blue-50 mr-2 w-50 hover:bg-blue-800'> 
              Confirm
            </Button>
            </div>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
           
            </div>
           
        </div>
        <div className='flex mt-10 border rounded-b-sm p-2'>
                <Button className='bg-gray-50 text-black mr-2 w-20 hover:bg-gray-200'><List className="w-5 h-5 text-gray-500 mr-2" />List</Button>
                <p className='text-gray-500 text-sm flex p-2'><Calendar className="w-5 h-4 text-gray-500 mr-2" />Calender</p>
                <p className='text-gray-500 text-sm flex p-2 ml-180'><Filter className="w-5 h-4 text-gray-500 mr-2" />Filter</p>
            </div>
            <div><Card className="mt-5 onhover:shadow-lg">
                <CardContent>
                    <div className='flex justify-between'>
                    <div className='text-left'>
                        <h2 className='text-black text-lg font-bold mb-2' >Leaking Faucet</h2>
                        <div className='flex '>
                        <p className='text-gray-500 text-sm'>Unit 101</p>
                        <p className='text-gray-500 text-sm ml-7'>2025-12-18</p></div>
                        
                    </div>
                    <div  ><Badge className='bg-blue-50 text-blue-600 mr-2 w-20 mt-2  rounded-3xl border-blue-600 '>Low Priority </Badge></div>
                    </div>
                   
                </CardContent>
                </Card></div>
                <div><Card className="mt-5">
                <CardContent>
                    <div className='flex justify-between'>
                    <div className='text-left'>
                        <h2 className='text-black text-lg font-bold mb-2' >Leaking Faucet</h2>
                        <div className='flex '>
                        <p className='text-gray-500 text-sm'>Unit 101</p>
                        <p className='text-gray-500 text-sm ml-7'>2025-12-18</p></div>
                        
                    </div>
                    <div  ><Badge className='bg-red-50 text-red-600 mr-2 w-20 mt-2  rounded-3xl border-red-600 '>High Priority </Badge></div>
                    </div>
                   
                </CardContent>
                </Card></div>
               
    </>
    );
}