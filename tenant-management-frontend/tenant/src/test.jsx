"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"

const data = [
    {
        tenant: "Aashish Karki",
        unit: "Sagar block - Birendra sadhan-a1",
        frequency: "Monthly",
        rent: 9090.91,
        cam: 1000,
        total: 10090.91,
        due: "2082-Cha-01",
        status: "Pending",
    },
]

export default function Test() {
    return (
        <div className="space-y-6 p-4">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">Rent Management</h2>
                    <div className="flex gap-2 mt-2">
                        <Button variant="secondary" size="sm">Monthly</Button>
                        <Button variant="ghost" size="sm">Quarterly</Button>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" size="sm">Process Rents</Button>
                    <Button variant="outline" size="sm">Send Reminders</Button>
                </div>
            </div>

            {/* Filters */}
            <Card className="p-3">
                <div className="flex flex-wrap gap-2 items-center">
                    <Select>
                        <SelectTrigger className="w-[130px] h-8">
                            <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="falgun">Falgun</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select>
                        <SelectTrigger className="w-[100px] h-8">
                            <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="2082">2082</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select>
                        <SelectTrigger className="w-[140px] h-8">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select>
                        <SelectTrigger className="w-[150px] h-8">
                            <SelectValue placeholder="Property" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Properties</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button variant="outline" size="sm">Overdue only</Button>

                    <div className="ml-auto">
                        <Input placeholder="Search tenant…" className="h-8 w-[200px]" />
                    </div>
                </div>
            </Card>

            {/* Collection Card */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                        Track monthly rent collection
                    </CardTitle>
                </CardHeader>

                <CardContent className="space-y-3">

                    {/* Progress */}
                    <div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                            <span>₹0 / ₹10,090.91</span>
                            <span>0% collected</span>
                        </div>
                        <Progress value={0} className="h-2 mt-1" />
                    </div>

                    {/* Table */}
                    <div className="rounded-md border">
                        <div className="grid grid-cols-8 text-sm font-medium bg-muted/50 px-3 py-2">
                            <div className="col-span-2">Tenant / Unit</div>
                            <div>Freq</div>
                            <div className="text-right">Rent</div>
                            <div className="text-right">CAM</div>
                            <div className="text-right">Total</div>
                            <div>Due</div>
                            <div className="text-right">Action</div>
                        </div>

                        {data.map((row, i) => (
                            <div
                                key={i}
                                className="grid grid-cols-8 items-center px-3 py-3 text-sm border-t hover:bg-muted/40"
                            >
                                <div className="col-span-2">
                                    <div className="font-medium">{row.tenant}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {row.unit}
                                    </div>
                                </div>

                                <div>{row.frequency}</div>
                                <div className="text-right">₹{row.rent}</div>
                                <div className="text-right">₹{row.cam}</div>
                                <div className="text-right font-medium">₹{row.total}</div>
                                <div>{row.due}</div>

                                <div className="flex justify-end gap-2">
                                    <Badge variant="secondary">{row.status}</Badge>
                                    <Button size="sm">Record</Button>
                                </div>
                            </div>
                        ))}
                    </div>

                </CardContent>
            </Card>
        </div>
    )
}