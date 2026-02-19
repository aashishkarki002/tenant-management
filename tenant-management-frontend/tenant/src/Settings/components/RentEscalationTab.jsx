import React, { useEffect, useState } from "react";
import api from "../../../plugins/axios";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function RentEscalationTab() {
    const [enabled, setEnabled] = useState(false);
    const [percentageIncrease, setPercentageIncrease] = useState(5);
    const [intervalMonths, setIntervalMonths] = useState(12);
    const [appliesTo, setAppliesTo] = useState("rent_only");
    const [loading, setLoading] = useState(false);

    async function fetchSettings() {
        try {
            const response = await api.get("/api/escalation/admin-settings");
            if (response.data.success) {
                const data = response.data.data;
                setEnabled(data.enabled);
                setPercentageIncrease(data.percentageIncrease);
                setIntervalMonths(data.intervalMonths);
                setAppliesTo(data.appliesTo);
            }
        } catch (error) {
            console.error(error);
        }
    }

    async function saveSettings() {
        try {
            setLoading(true);
            const response = await api.post("/api/escalation/admin-settings", {
                enabled,
                percentageIncrease,
                intervalMonths,
                appliesTo,
            });

            if (response.data.success) {
                toast.success("Escalation settings updated successfully");
            }
        } catch (error) {
            toast.error("Failed to update escalation settings");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchSettings();
    }, []);

    return (
        <div className="space-y-6">
            <Card className="rounded-xl shadow-sm">
                <CardHeader>
                    <CardTitle>Default Rent Escalation Policy</CardTitle>
                </CardHeader>

                <CardContent className="space-y-6">

                    <div className="flex items-center justify-between">
                        <Label>Enable System-Wide Escalation</Label>
                        <Switch checked={enabled} onCheckedChange={setEnabled} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <Label>Default Percentage Increase (%)</Label>
                            <Input
                                type="number"
                                value={percentageIncrease}
                                onChange={(e) => setPercentageIncrease(e.target.value)}
                            />
                        </div>

                        <div>
                            <Label>Interval (Months)</Label>
                            <Input
                                type="number"
                                value={intervalMonths}
                                onChange={(e) => setIntervalMonths(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Applies To</Label>
                        <div className="flex gap-4 mt-2">
                            <Button
                                variant={appliesTo === "rent_only" ? "default" : "outline"}
                                onClick={() => setAppliesTo("rent_only")}
                            >
                                Rent Only
                            </Button>

                            <Button
                                variant={appliesTo === "cam_only" ? "default" : "outline"}
                                onClick={() => setAppliesTo("cam_only")}
                            >
                                CAM Only
                            </Button>

                            <Button
                                variant={appliesTo === "both" ? "default" : "outline"}
                                onClick={() => setAppliesTo("both")}
                            >
                                Both
                            </Button>
                        </div>
                    </div>

                    <div className="pt-4">
                        <Button onClick={saveSettings} disabled={loading}>
                            {loading ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>

                </CardContent>
            </Card>
        </div>
    );
}
