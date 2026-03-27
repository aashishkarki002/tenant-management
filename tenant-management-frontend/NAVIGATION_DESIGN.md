# Modern SaaS Navigation Design
## Tenant Management System - Information Architecture

---

## 🎯 Design Principles

1. **Object-First Navigation**: Organize by domain entities, not features
2. **Contextual Actions**: Operations appear where users focus attention
3. **Reduced Cognitive Load**: Limit top-level items to essential domains
4. **Progressive Disclosure**: Use collapsible sections for secondary features
5. **Visual Hierarchy**: Clear grouping with consistent spacing and typography

---

## 📊 Navigation Structure

### PRIMARY (Always Visible)

```
Dashboard
```

### CORE (Domain Objects)

```
Buildings
  ├─ View all buildings
  ├─ Add new building
  └─ [Contextual: Migrate ownership]

Units
  ├─ View all units
  ├─ Vacant units
  └─ Occupied units

Tenants
  ├─ Active tenants
  ├─ Past tenants
  └─ Tenant applications
```

### FINANCE

```
Rent & Payments
  ├─ Payment dashboard
  ├─ Pending payments
  └─ Payment history

Accounting
  ├─ Revenue & expenses
  ├─ Financial reports
  └─ Export data
```

### OPERATIONS

```
Daily Checks [Today badge]
  ├─ Today's checklist
  └─ History

Maintenance
  ├─ Active requests
  ├─ Scheduled maintenance
  └─ Maintenance history
```

### UTILITIES

```
Electricity
  ├─ Meter readings
  ├─ Billing
  └─ Payment tracking
```

### MORE (Collapsible)

```
▼ More
  ├─ Loans
  └─ Cheque Drafts
```

### FOOTER (Settings)

```
[User Avatar & Name]
  ├─ Account Settings
  ├─ Organization Settings (company info, roles only)
  ├─ Appearance
  └─ Sign Out
```

---

## 🏢 Buildings Page Design

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Buildings                                          [+ Add]   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  [Search]  [Filter: All ▼]  [Sort: Name ▼]                  │
│                                                               │
│  ┌───────────────────────────────────────┐                  │
│  │ Sallyan House Main Building           │                  │
│  │ ─────────────────────────────────────  │                  │
│  │ 📍 Boudha, Kathmandu                   │                  │
│  │ 🏠 12 units • 10 occupied • 2 vacant   │                  │
│  │ 👤 Current owner: Ram Sharma           │                  │
│  │                                         │                  │
│  │ [View Details]  [Migrate Ownership]    │  ← Contextual   │
│  └───────────────────────────────────────┘     Action       │
│                                                               │
│  ┌───────────────────────────────────────┐                  │
│  │ Sallyan House Annex                    │                  │
│  │ ─────────────────────────────────────  │                  │
│  │ 📍 Boudha, Kathmandu                   │                  │
│  │ 🏠 8 units • 8 occupied                │                  │
│  │ 👤 Current owner: Sita Thapa           │                  │
│  │                                         │                  │
│  │ [View Details]  [Migrate Ownership]    │                  │
│  └───────────────────────────────────────┘                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Migration Flow (Modal/Side Panel)

When user clicks "Migrate Ownership":

```
┌─────────────────────────────────────────┐
│ Migrate Building Ownership              │
├─────────────────────────────────────────┤
│                                          │
│ Building: Sallyan House Main Building   │
│ Current Owner: Ram Sharma               │
│                                          │
│ ┌──────────────────────────────────────┐│
│ │ New Owner *                          ││
│ │ [Select user ▼]                      ││
│ └──────────────────────────────────────┘│
│                                          │
│ ┌──────────────────────────────────────┐│
│ │ Transfer Date *                      ││
│ │ [2026-03-27]                         ││
│ └──────────────────────────────────────┘│
│                                          │
│ ┌──────────────────────────────────────┐│
│ │ Transfer Notes (optional)            ││
│ │                                      ││
│ │                                      ││
│ └──────────────────────────────────────┘│
│                                          │
│ ⚠️ This will transfer all units,        │
│    tenants, and financial records       │
│    associated with this building.       │
│                                          │
│ [Cancel]              [Migrate Ownership]│
└─────────────────────────────────────────┘
```

---

## 🎨 Visual Design System

### Typography

```css
/* Group Labels */
font-size: 9px
font-weight: 500-600
letter-spacing: 0.24em (24%)
text-transform: uppercase
opacity: 0.6

/* Navigation Items */
font-size: 13px
font-weight: 500
letter-spacing: 0

/* Section Headings */
font-size: 20-24px
font-weight: 600
```

### Spacing

```css
/* Sidebar padding */
padding: 12px (py-3 px-3)

/* Group spacing */
margin-bottom: 16px (space-y-4)

/* Item spacing */
gap: 4px (gap-1)

/* Icon + text spacing */
gap: 10px (gap-2.5)
```

### Colors (CSS Variables)

```css
--sidebar-background: hsl(var(--sidebar))
--sidebar-foreground: hsl(var(--sidebar-foreground))
--sidebar-border: hsl(var(--sidebar-border))

/* Active state */
--sidebar-primary: hsl(var(--sidebar-primary))
--sidebar-primary-foreground: hsl(var(--sidebar-primary-foreground))
--sidebar-ring: hsl(var(--sidebar-ring)) /* left indicator */

/* Hover state */
--sidebar-accent: hsl(var(--sidebar-accent))
--sidebar-accent-foreground: hsl(var(--sidebar-accent-foreground))
```

### Interactive States

```css
/* Default */
background: transparent
transition: colors 200ms

/* Hover */
background: var(--sidebar-accent)
color: var(--sidebar-accent-foreground)

/* Active */
background: var(--sidebar-primary)
color: var(--sidebar-primary-foreground)
left-border: 2px solid var(--sidebar-ring)
```

### Icons

- Size: 14px (w-3.5 h-3.5)
- Stroke width: 2px (default Lucide)
- Color: Inherits from text color

---

## 🧭 User Mental Model

### Before (Problem)
```
Settings → Organization → Migration
   ↑           ↑            ↑
Hidden    Generic    Lost feature
```

**Issues:**
- Users don't think "I need to change settings to migrate a building"
- Settings implies configuration, not operations
- Migration is a domain action, not a system setting

### After (Solution)
```
Buildings → [Building Card] → Migrate Ownership
   ↑              ↑                  ↑
Domain       Context           Clear action
```

**Benefits:**
- Users think "I'm managing buildings, so I go to Buildings"
- Migration appears where it's relevant (on the building itself)
- Clear, discoverable, and aligned with user intent

---

## 📐 Navigation Hierarchy

```
Level 1: Domain Groups (4-5 groups)
  └─ Level 2: Domain Objects (2-3 items per group)
      └─ Level 3: Contextual Actions (shown in detail pages, not sidebar)
```

**Examples:**

```
Core
├─ Buildings (Level 2)
│   └─ [On Buildings page] → Migrate Ownership (Level 3)
├─ Units (Level 2)
└─ Tenants (Level 2)
```

---

## 🎯 Key Improvements Over Current Design

| Aspect | Before | After |
|--------|--------|-------|
| **Top-level items** | 8+ items flat | 4-5 groups, 10-12 items total |
| **Migration location** | Settings → Organization | Buildings → Contextual action |
| **Visual hierarchy** | Flat list | Grouped with clear labels |
| **Domain focus** | Mixed features & objects | Object-first organization |
| **Discoverability** | Hidden 3 levels deep | Visible where relevant |
| **Scalability** | Hard to add features | Easy to add within groups |

---

## 🚀 Implementation Notes

### Phase 1: Sidebar Update
1. Add Buildings to Core group
2. Reorder groups: Core → Finance → Operations → Utilities
3. Ensure Dashboard remains at top (ungrouped)

### Phase 2: Buildings Page
1. Create `/buildings` route
2. Build building card/table view
3. Add "Migrate Ownership" button to each building
4. Create migration modal/dialog

### Phase 3: Migration Logic
1. Move migration logic from Settings to Buildings context
2. Update API calls if needed
3. Add proper validation and confirmation flows

### Phase 4: Settings Cleanup
1. Remove migration from Settings → Organization
2. Keep only configuration items: company info, roles, permissions
3. Update documentation

---

## 🎨 Design Inspiration

**Stripe Dashboard**: Clean grouping, minimal top-level items, contextual actions  
**Linear**: Strong visual hierarchy, subtle animations, clear active states  
**Notion**: Collapsible sections, progressive disclosure, icon consistency

---

## ✅ Checklist

- [ ] Update sidebar navigation structure
- [ ] Create Buildings page with card/table layout
- [ ] Implement migration modal with proper form
- [ ] Add contextual action buttons to building cards
- [ ] Remove migration from Settings → Organization
- [ ] Update routing
- [ ] Test user flows
- [ ] Update user documentation

---

**Last Updated**: March 27, 2026  
**Status**: Design Complete → Ready for Implementation
