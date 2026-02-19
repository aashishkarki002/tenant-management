import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { User, Mail, Phone, Building, MapPin, Save } from "lucide-react"

export default function Test() {
    const [isEditing, setIsEditing] = useState(false)

    const [formData, setFormData] = useState({
        name: "Aashish Karki",
        email: "admin@example.com",
        phone: "+977 98XXXXXXXX",
        company: "Karki Properties",
        address: "Kathmandu, Nepal",
    })

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    return (
        <Card
            title="Admin Details"
            subtitle="Manage your administrator profile and contact information"
            className="p-6"
        >
            <div className="space-y-6">

                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-50 rounded-xl">
                        <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                            Administrator Profile
                        </h3>
                        <p className="text-sm text-slate-500">
                            These details are used for official communications
                        </p>
                    </div>
                </div>

                {/* Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                    <ProfileField
                        icon={<User className="w-4 h-4" />}
                        label="Full Name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        isEditing={isEditing}
                    />

                    <ProfileField
                        icon={<Mail className="w-4 h-4" />}
                        label="Email Address"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        isEditing={isEditing}
                    />

                    <ProfileField
                        icon={<Phone className="w-4 h-4" />}
                        label="Phone Number"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        isEditing={isEditing}
                    />

                    <ProfileField
                        icon={<Building className="w-4 h-4" />}
                        label="Company Name"
                        name="company"
                        value={formData.company}
                        onChange={handleChange}
                        isEditing={isEditing}
                    />

                    <div className="md:col-span-2">
                        <ProfileField
                            icon={<MapPin className="w-4 h-4" />}
                            label="Office Address"
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            isEditing={isEditing}
                        />
                    </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                    {!isEditing ? (
                        <Button onClick={() => setIsEditing(true)}>
                            Edit Profile
                        </Button>
                    ) : (
                        <>
                            <Button onClick={() => setIsEditing(false)} icon={Save}>
                                Save Changes
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => setIsEditing(false)}
                            >
                                Cancel
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </Card>
    )
}

/* Reusable Field Component */

function ProfileField({
    icon,
    label,
    name,
    value,
    onChange,
    isEditing,
}) {
    return (
        <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                {icon} {label}
            </label>
            <Input
                name={name}
                value={value}
                onChange={onChange}
                readOnly={!isEditing}
                className={`${!isEditing
                    ? "bg-slate-50 border-slate-200 text-slate-700"
                    : "bg-white border-blue-400 ring-1 ring-blue-200"
                    }`}
            />
        </div>
    )
}
