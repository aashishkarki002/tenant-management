import React from "react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
} from "@/components/ui/table";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RentTableRow } from "./RentTableRow";
import { PaymentDialog } from "./PaymentDialog";

/**
 * Component for displaying rent table
 */
export const RentTable = ({
  rents,
  cams,
  bankAccounts,
  formik,
  allocationMode,
  setAllocationMode,
  rentAllocation,
  setRentAllocation,
  camAllocation,
  setCamAllocation,
  selectedBankAccountId,
  setSelectedBankAccountId,
  handleOpenDialog,
  handleAmountChange,
}) => {
  const [selectedRent, setSelectedRent] = React.useState(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const handleOpen = (rent) => {
    setSelectedRent(rent);
    handleOpenDialog(rent);
    setDialogOpen(true);
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tenant / Unit</TableHead>
            <TableHead>Frequency</TableHead>
            <TableHead>Rent Amount</TableHead>

            <TableHead>CAM Amount</TableHead>
            <TableHead>Total Amount</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rents.map((rent, idx) => (
            <RentTableRow
              key={rent._id || idx}
              rent={rent}
              cams={cams}
              onOpenPaymentDialog={handleOpen}
            />
          ))}
        </TableBody>
      </Table>

      {/* Payment Dialog */}
      {selectedRent && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <PaymentDialog
            rent={selectedRent}
            cams={cams}
            bankAccounts={bankAccounts}
            formik={formik}
            allocationMode={allocationMode}
            setAllocationMode={setAllocationMode}
            rentAllocation={rentAllocation}
            setRentAllocation={setRentAllocation}
            camAllocation={camAllocation}
            setCamAllocation={setCamAllocation}
            selectedBankAccountId={selectedBankAccountId}
            setSelectedBankAccountId={setSelectedBankAccountId}
            handleAmountChange={handleAmountChange}
            onClose={() => setDialogOpen(false)}
          />
        </Dialog>
      )}
    </>
  );
};
