import React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import api from '../plugins/axios';

const statusVariant = {
  Paid: 'success',
  paid: 'success',
  Overdue: 'destructive',
  overdue: 'destructive',
  'Due Now': 'warning',
  'due now': 'warning',
  pending: 'warning',
  Pending: 'warning',
};

export default function RentDashboard() {
  const [rents, setRents] = useState([]);

  const getRents = async () => {
    const response = await api.get('/api/rent/get-rents');
    setRents(response.data.rents);
    console.log(response.data.rents);   
  };

  useEffect(() => {
    getRents();
  }, []);

  // Calculate totals from actual data
  const totalCollected = rents.reduce((sum, rent) => sum + (rent.paidAmount || 0), 0);
  const totalDue = rents.reduce((sum, rent) => sum + (rent.rentAmount || 0), 0);

  // Helper function to format due date from month and year
  const formatDueDate = (month, year) => {
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <>
      <div className="mb-6">
        <p className='text-2xl font-bold'>Rent & Payments</p>
        <p className='text-gray-500 text-sm'>Track monthly rent collection</p>
      </div>

      <Card className="max-w-5xl mx-auto mt-6">
      <CardHeader>
        <CardTitle>Rent & Payments</CardTitle>
        <CardDescription>Track monthly rent collection</CardDescription>
        <div className="mt-2 text-sm text-muted-foreground">
          <strong>Total Collected:</strong>{' '}
          <span className="text-primary">
          ₹{totalCollected.toLocaleString()} / ₹{totalDue.toLocaleString()}
          </span>
        </div>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant / Unit</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rents.map((rent, idx) => (
              <TableRow key={rent._id || idx}>
                <TableCell>
                  <div className="font-medium">
                    {rent.tenant ? rent.tenant.name : 'No Tenant Assigned'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {rent.innerBlock?.name || 'N/A'} - {rent.block?.name || 'N/A'}
                  </div>
                </TableCell>
                <TableCell>₹{rent.rentAmount?.toLocaleString() || '0'}</TableCell>
                <TableCell>{formatDueDate(rent.month, rent.year)}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[rent.status] || 'default'}>
                    {rent.status || 'Unknown'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" className="bg-blue-600 text-white hover:bg-blue-800 hover:text-white">
                    Record Payment
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card></>
  );
}