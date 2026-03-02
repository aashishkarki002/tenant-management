import { useEffect, useState } from 'react';
import { UnitBlock } from './UnitBlock';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function FloorPlanView({ units, buildings = [], property, stats, onUnitClick }) {
    const [selectedBuildingId, setSelectedBuildingId] = useState('all');
    const [selectedFloor, setSelectedFloor] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [viewMode, setViewMode] = useState('blueprint');

    const selectedBuilding = selectedBuildingId === 'all'
        ? null
        : buildings.find((b) => b._id === selectedBuildingId) ?? null;

    const unitsInSelectedBuilding = selectedBuildingId === 'all'
        ? units
        : units.filter((u) => u.buildingId === selectedBuildingId);

    const floors = [...new Set(unitsInSelectedBuilding.map((u) => u.floor))].sort();

    useEffect(() => {
        if (floors.length === 0) return;
        if (!floors.includes(selectedFloor)) {
            setSelectedFloor(floors[0]);
        }
    }, [floors, selectedFloor]);

    const filteredUnits = unitsInSelectedBuilding.filter((unit) => {
        const matchesBuilding = selectedBuildingId === 'all' || unit.buildingId === selectedBuildingId;
        const matchesFloor = unit.floor === selectedFloor;
        const matchesSearch =
            searchQuery === '' ||
            unit.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            unit.tenant?.name?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || unit.status === statusFilter;

        return matchesBuilding && matchesFloor && matchesSearch && matchesStatus;
    });

    return (
        <div className="flex-1 p-6 space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {property?.name ?? 'Property'}
                    </h1>
                    <p className="text-sm text-gray-500">
                        {(selectedBuilding?.name ?? 'All Buildings')} • Floor {selectedFloor}
                    </p>

                    <div className="mt-3">
                        <label className="text-xs font-medium text-gray-500 block mb-1">
                            Building
                        </label>
                        <select
                            className="border border-gray-300 rounded-md px-3 py-1 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={selectedBuildingId}
                            onChange={(e) => setSelectedBuildingId(e.target.value)}
                        >
                            <option value="all">All buildings</option>
                            {buildings.map((building) => (
                                <option key={building._id} value={building._id}>
                                    {building.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex gap-6 text-sm">
                    <div>Total Units: {stats?.totalUnits ?? 0}</div>
                    <div className="text-green-600">Occupied: {stats?.occupied ?? 0}</div>
                    <div className="text-red-600">Overdue: {stats?.overdue ?? 0}</div>
                </div>
            </div>
            <Card className="p-8 bg-white shadow-xl border-gray-200">
                <Tabs value={selectedFloor.toString()} onValueChange={(v) => setSelectedFloor(Number(v))}>
                    <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 mb-8">
                        {floors.map((floor) => (
                            <TabsTrigger key={floor} value={floor.toString()}>
                                Floor {floor}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {floors.map(floor => (
                        <TabsContent key={floor} value={floor.toString()} className="mt-0">
                            <div className="relative w-full min-h-[650px] bg-slate-50 rounded-2xl border">

                                {/* COURTYARD */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-[45%] h-[45%] bg-emerald-50 border-2 border-dashed border-emerald-400 rounded-2xl flex items-center justify-center shadow-inner">
                                        <span className="text-emerald-700 font-semibold tracking-wider">
                                            SALLYAN HOUSE COURTYARD
                                        </span>
                                    </div>
                                </div>

                                {/* NARENDRA SADHAN - TOP */}
                                <div className="absolute top-0 left-[20%] right-[20%]">
                                    <h3 className="text-xs font-semibold text-gray-500 mb-2 text-center">
                                        NARENDRA SADHAN
                                    </h3>
                                    <div className="flex justify-center gap-3">
                                        {filteredUnits
                                            .filter(u => u.wing === "top")
                                            .map(unit => (
                                                <UnitBlock key={unit.id} unit={unit} onClick={onUnitClick} />
                                            ))}
                                    </div>
                                </div>

                                {/* NARENDRA SADHAN - LEFT */}
                                <div className="absolute top-[15%] bottom-[15%] left-0">
                                    <div className="flex flex-col justify-center gap-3 h-full">
                                        {filteredUnits
                                            .filter(u => u.wing === "left")
                                            .map(unit => (
                                                <UnitBlock key={unit.id} unit={unit} onClick={onUnitClick} />
                                            ))}
                                    </div>
                                </div>

                                {/* BIRENDRA SADHAN - RIGHT */}
                                <div className="absolute top-[15%] bottom-[15%] right-0">
                                    <div className="flex flex-col justify-center gap-3 h-full">
                                        {filteredUnits
                                            .filter(u => u.wing === "right")
                                            .map(unit => (
                                                <UnitBlock key={unit.id} unit={unit} onClick={onUnitClick} />
                                            ))}
                                    </div>
                                </div>

                                {/* BIRENDRA SADHAN - BOTTOM */}
                                <div className="absolute bottom-0 left-[20%] right-[20%]">
                                    <h3 className="text-xs font-semibold text-gray-500 mb-2 text-center">
                                        BIRENDRA SADHAN
                                    </h3>
                                    <div className="flex justify-center gap-3">
                                        {filteredUnits
                                            .filter(u => u.wing === "bottom")
                                            .map(unit => (
                                                <UnitBlock key={unit.id} unit={unit} onClick={onUnitClick} />
                                            ))}
                                    </div>
                                </div>

                            </div>


                        </TabsContent>
                    ))}
                </Tabs>
            </Card>
        </div>
    );
}

function LegendItem({ color, label }) {
    return (
        <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded ${color} border-2 border-gray-400`} />
            <span className="text-sm text-gray-600">{label}</span>
        </div>
    );
}
