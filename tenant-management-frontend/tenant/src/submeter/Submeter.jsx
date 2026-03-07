import React from 'react'
import SubMetersTab from './components/SubMetersTab'
import useProperty from '@/hooks/use-property'

function Submeter() {
    const { property } = useProperty()
    const propertyId = Array.isArray(property) ? property[0]?._id : property?._id

    return (
        <div>
            <SubMetersTab propertyId={propertyId} />
        </div>
    )
}

export default Submeter