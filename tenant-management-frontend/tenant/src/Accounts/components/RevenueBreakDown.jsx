import React, { useState, useEffect, useCallback } from 'react'
import { AddRevenueDialog } from './AddRevenueDialog'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import DetailDonutChart from './DetailDonutChart'
import LedgerTable from './LedgerTable'
import { Button } from '@/components/ui/button'
import { PlusIcon } from 'lucide-react'
import { Empty } from '@/components/ui/empty'
import { useNavigate } from 'react-router-dom'
import api from '../../../plugins/axios'

export default function RevenueBreakDown({ totals, incomeStreams, ledgerEntries, loadingSummary, loadingLedger, onRevenueAdded }) {
    const navigate = useNavigate()
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [tenants, setTenants] = useState([])
    const [revenueSource, setRevenueSource] = useState([])
    const [bankAccounts, setBankAccounts] = useState([])

    useEffect(() => {
        const fetchTenants = async () => {
            try {
                const response = await api.get('/api/tenant/get-tenants')
                setTenants(response.data?.tenants ?? [])
            } catch (error) {
                console.error('Error fetching tenants:', error)
            }
        }
        const fetchRevenueSource = async () => {
            try {
                const response = await api.get('/api/revenue/get-revenue-source')
                setRevenueSource(response.data?.revenueSource ?? [])
            } catch (error) {
                console.error('Error fetching revenue source:', error)
            }
        }
        const fetchBankAccounts = async () => {
            try {
                const response = await api.get('/api/bank/get-bank-accounts')
                setBankAccounts(response.data?.bankAccounts ?? [])
            } catch (error) {
                console.error('Error fetching bank accounts:', error)
            }
        }
        fetchTenants()
        fetchRevenueSource()
        fetchBankAccounts()
    }, [])

    const handleRevenueSuccess = useCallback(() => {
        onRevenueAdded?.()
    }, [onRevenueAdded])
    return (
        <>
            <div>

                {/* Revenue KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 ">
                    <Card>
                        <CardHeader>
                            <CardTitle>Total Revenue</CardTitle>
                        </CardHeader>
                        <CardContent className="text-2xl font-bold text-green-600">
                            ₹{totals.totalRevenue.toLocaleString()}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Top Revenue Source</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {incomeStreams[0]?.name || "—"}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Revenue Streams</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {incomeStreams.length}
                        </CardContent>
                    </Card>

                    <Button
                        variant="outline"
                        className="w-1/3 ml-auto  bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer hover:text-white"
                        onClick={() => setIsDialogOpen(true)}
                    >
                        <PlusIcon className="w-6 h-6 text-white" />
                        Add Revenue
                    </Button>



                </div>

                {/* Revenue Charts */}
                <Card className="mt-4">
                    <CardHeader>
                        <CardTitle>Revenue Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DetailDonutChart
                            data={incomeStreams}
                            title="Revenue by Source"
                            loading={loadingSummary}
                            colors={["#10b981", "#34d399", "#6ee7b7", "#a7f3d0"]}
                        />
                    </CardContent>
                </Card>


                {/* Revenue Ledger */}
                <Card>
                    <CardHeader>
                        <CardTitle>Revenue Ledger Entries</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <LedgerTable
                            entries={ledgerEntries}
                            loading={loadingLedger}
                            itemsPerPage={20}
                        />
                    </CardContent>
                </Card>


            </div>
            <AddRevenueDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                tenants={tenants}
                revenueSource={revenueSource}
                bankAccounts={bankAccounts}
                onSuccess={handleRevenueSuccess}
            />
        </>
    )
}