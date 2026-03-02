import { motion } from "motion/react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

const statusColors = {
    occupied: "bg-green-400 hover:bg-green-500 border-green-500",
    vacant: "bg-gray-300 hover:bg-gray-400 border-gray-400",
    overdue: "bg-red-400 hover:bg-red-500 border-red-500",
    reserved: "bg-yellow-300 hover:bg-yellow-400 border-yellow-400",
    "owner-occupied": "bg-blue-400 hover:bg-blue-500 border-blue-500",
};

export function UnitBlock({ unit, onClick }) {
    const hasDetails = unit.tenant || unit.rentAmount;

    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <motion.div
                        className={`
              cursor-pointer 
              rounded-lg 
              border-2 
              transition-all 
              duration-200 
              flex 
              items-center 
              justify-center
              w-[120px] 
              h-[80px]
              ${statusColors[unit.status]}
            `}
                        whileHover={{
                            scale: 1.06,
                            boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
                        }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => onClick(unit)}
                    >
                        <div className="text-center">
                            <div className="font-semibold text-gray-800">
                                {unit.id}
                            </div>

                            {unit.status === "vacant" && (
                                <div className="text-xs text-gray-600">
                                    Available
                                </div>
                            )}

                            {unit.status === "overdue" && (
                                <div className="text-xs font-semibold text-red-800">
                                    Overdue
                                </div>
                            )}
                        </div>
                    </motion.div>
                </TooltipTrigger>

                {hasDetails && (
                    <TooltipContent
                        side="top"
                        className="bg-white border-gray-200 shadow-lg p-3 max-w-xs rounded-lg"
                    >
                        <div className="space-y-1">
                            {unit.tenant && (
                                <>
                                    <p className="font-semibold text-gray-900">
                                        {unit.tenant.name}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        {unit.tenant.phone}
                                    </p>
                                </>
                            )}

                            {unit.rentAmount && (
                                <p className="text-sm font-medium text-gray-700">
                                    Rent: NPR {unit.rentAmount.toLocaleString()}
                                </p>
                            )}

                            {unit.remainingAmount > 0 && (
                                <p className="text-sm font-semibold text-red-600">
                                    Due: NPR {unit.remainingAmount.toLocaleString()}
                                </p>
                            )}

                            {unit.dueDate && (
                                <p className="text-xs text-gray-500">
                                    Due Date: {unit.dueDate}
                                </p>
                            )}
                        </div>
                    </TooltipContent>
                )}
            </Tooltip>
        </TooltipProvider>
    );
}