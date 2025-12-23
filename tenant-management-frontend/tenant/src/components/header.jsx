import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { Search } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
export default function Header() {
  return (
    <div className="flex  justify-between items-center p-4 w-full gap-4">
      <div className="relative w-full sm:flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <Input
          type="text"
          className="w-full pl-10 h-10 text-sm border-gray-300 rounded-md"
          placeholder="Search name, unit, lease end (YYYY-MM-DD)"
        />
      </div>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" className="w-10 h-10 rounded-full">
            <Bell className="w-5 h-5 text-gray-500" />
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Notifications</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-gray-500" />
              <p className="text-sm text-gray-500">Notification 1</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-gray-500" />
              <p className="text-sm text-gray-500">Notification 2</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
