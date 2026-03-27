# Visual Mockups: Navigation Redesign

---

## 🎨 Sidebar Comparison

### BEFORE

```
┌────────────────────────────────────┐
│ [Logo] Sallyan House               │
│        MANAGEMENT                   │
├────────────────────────────────────┤
│                                     │
│ PEOPLE                              │
│ [●] Dashboard                       │  ← Dashboard grouped with People
│ [ ] Tenants                         │
│ [ ] Units                           │
│                                     │  ← No Buildings section
│ FINANCE                             │
│ [ ] Rent & Payments                 │
│ [ ] Accounting                      │
│                                     │
│ OPERATIONS                          │
│ [ ] Daily Checks        [Today]     │
│ [ ] Maintenance                     │
│                                     │
│ UTILITIES                           │
│ [ ] Electricity                     │
│                                     │
│ MORE                      ▼         │
│   Loans                             │
│   Cheque Drafts                     │
│                                     │
├────────────────────────────────────┤
│ [Avatar] Ram Sharma        ▼       │
│          admin@example.com         │
└────────────────────────────────────┘

ISSUES:
❌ Dashboard grouped under "People"
❌ No Buildings navigation
❌ "People" is too generic as a label
❌ Migration hidden in Settings (not shown)
```

### AFTER

```
┌────────────────────────────────────┐
│ [Logo] Sallyan House               │
│        MANAGEMENT                   │
├────────────────────────────────────┤
│                                     │
│ [●] Dashboard                       │  ← Dashboard ungrouped (primary)
│                                     │
│ CORE                                │  ← Better semantic grouping
│ [■] Buildings                       │  ← NEW: Buildings section
│ [ ] Units                           │
│ [ ] Tenants                         │
│                                     │
│ FINANCE                             │
│ [ ] Rent & Payments                 │
│ [ ] Accounting                      │
│                                     │
│ OPERATIONS                          │
│ [ ] Daily Checks        [Today]     │
│ [ ] Maintenance                     │
│                                     │
│ UTILITIES                           │
│ [ ] Electricity                     │
│                                     │
│ MORE                      ▼         │
│   Loans                             │
│   Cheque Drafts                     │
│                                     │
├────────────────────────────────────┤
│ [Avatar] Ram Sharma        ▼       │
│          admin@example.com         │
└────────────────────────────────────┘

IMPROVEMENTS:
✅ Dashboard as primary item (no group)
✅ Buildings prominently featured
✅ "Core" better represents domain objects
✅ Clear visual hierarchy
```

---

## 🏢 Buildings Page Layout

### Desktop View (Grid)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Buildings                                             [+ Add Building]      │
│ Manage your properties and ownership                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ [🔍 Search buildings...]  [Filter: All ▼]  [Sort: Name ▼]                 │
│                                                                             │
│ ┌───────────────────────────────────────┐  ┌──────────────────────────────┐│
│ │ ┌───┐ Sallyan House Main Building     │  │ ┌───┐ Sallyan House Annex   ││
│ │ │🏢│ 📍 Boudha, Kathmandu              │  │ │🏢│ 📍 Boudha, Kathmandu    ││
│ │ └───┘                                  │  │ └───┘                        ││
│ │                                        │  │                              ││
│ │ 🏠 12 units    👥 10 occupied         │  │ 🏠 8 units    👥 8 occupied  ││
│ │                                        │  │                              ││
│ │ [Fully Occupied]                      │  │ [Fully Occupied]             ││
│ │                                        │  │                              ││
│ │ ┌────────────────────────────────┐    │  │ ┌──────────────────────────┐ ││
│ │ │ Current Owner                  │    │  │ │ Current Owner            │ ││
│ │ │ Ram Sharma                     │    │  │ │ Sita Thapa               │ ││
│ │ └────────────────────────────────┘    │  │ └──────────────────────────┘ ││
│ │                                        │  │                              ││
│ │ [View Details]  [Migrate Ownership]   │  │ [View Details] [Migrate]     ││
│ │                       ↑                │  │                              ││
│ │                   KEY ACTION           │  │                              ││
│ └───────────────────────────────────────┘  └──────────────────────────────┘│
│                                                                             │
│ ┌───────────────────────────────────────┐  ┌──────────────────────────────┐│
│ │ ┌───┐ Sallyan Commercial Complex      │  │                              ││
│ │ │🏢│ 📍 Jorpati, Kathmandu             │  │      [Add New Building]      ││
│ │ └───┘                                  │  │                              ││
│ │                                        │  │                              ││
│ │ 🏠 6 units     👥 5 occupied          │  │                              ││
│ │                                        │  │                              ││
│ │ [1 Vacant]                            │  │                              ││
│ │                                        │  │                              ││
│ │ ┌────────────────────────────────┐    │  │                              ││
│ │ │ Current Owner                  │    │  │                              ││
│ │ │ Ram Sharma                     │    │  │                              ││
│ │ └────────────────────────────────┘    │  │                              ││
│ │                                        │  │                              ││
│ │ [View Details]  [Migrate Ownership]   │  │                              ││
│ └───────────────────────────────────────┘  └──────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Desktop View (Table)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ Buildings                                                       [+ Add Building]    │
│ Manage your properties and ownership                                                │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│ [🔍 Search...]  [Filter ▼]  [Sort ▼]                        [≡] [▦]  ← Toggle    │
│                                                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────────────┐│
│ │ Building Name          │ Location      │ Units │ Occupancy │ Owner     │ Actions││
│ ├─────────────────────────────────────────────────────────────────────────────────┤│
│ │ 🏢 Sallyan Main       │ Boudha, KTM   │  12   │   83%     │ Ram      │ 👁 ⇄ ⋮ ││
│ │                        │               │ 10/12 │ [Full]    │ Sharma   │         ││
│ ├─────────────────────────────────────────────────────────────────────────────────┤│
│ │ 🏢 Sallyan Annex      │ Boudha, KTM   │   8   │  100%     │ Sita     │ 👁 ⇄ ⋮ ││
│ │                        │               │  8/8  │ [Full]    │ Thapa    │    ↑    ││
│ │                        │               │       │           │          │ Migrate ││
│ ├─────────────────────────────────────────────────────────────────────────────────┤│
│ │ 🏢 Sallyan Commercial │ Jorpati, KTM  │   6   │   83%     │ Ram      │ 👁 ⇄ ⋮ ││
│ │                        │               │  5/6  │ [1 vacant]│ Sharma   │         ││
│ └─────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────────────┐│
│ │ Summary                                                                          ││
│ │ Total Buildings: 3  │  Total Units: 26  │  Occupied: 23  │  Avg Occupancy: 88% ││
│ └─────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘

LEGEND:
👁 = View Details
⇄ = Migrate Ownership  ← KEY ACTION
⋮ = More options
```

### Mobile View

```
┌───────────────────────────┐
│ ☰  Buildings        [+]   │
├───────────────────────────┤
│ [Search.............]     │
│ [Filter ▼]  [Sort ▼]     │
├───────────────────────────┤
│                           │
│ ┌───────────────────────┐ │
│ │ 🏢 Sallyan Main       │ │
│ │ 📍 Boudha, Kathmandu   │ │
│ │                       │ │
│ │ 🏠 12 units           │ │
│ │ 👥 10 occupied        │ │
│ │ [Fully Occupied]      │ │
│ │                       │ │
│ │ Owner: Ram Sharma     │ │
│ │                       │ │
│ │ ┌──────────────────┐  │ │
│ │ │  View Details    │  │ │
│ │ └──────────────────┘  │ │
│ │ ┌──────────────────┐  │ │
│ │ │ Migrate Ownership│  │ │ ← Stacked buttons
│ │ └──────────────────┘  │ │   for mobile
│ └───────────────────────┘ │
│                           │
│ ┌───────────────────────┐ │
│ │ 🏢 Sallyan Annex      │ │
│ │ ...                   │ │
│ └───────────────────────┘ │
│                           │
└───────────────────────────┘
```

---

## 🔄 Migration Modal States

### Step 1: Initial State

```
┌─────────────────────────────────────────────────┐
│ Migrate Building Ownership              [✕]    │
├─────────────────────────────────────────────────┤
│                                                 │
│ Transfer ownership of this building to a new   │
│ owner. All associated units, tenants, and       │
│ financial records will be transferred.          │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ Building: Sallyan House Main Building       │ │
│ │ Current Owner: Ram Sharma                   │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ New Owner *                                     │
│ ┌─────────────────────────────────────────────┐ │
│ │ Select new owner                     ▼     │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Transfer Date *                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 2026-03-27                          📅      │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Transfer Notes (optional)                       │
│ ┌─────────────────────────────────────────────┐ │
│ │                                             │ │
│ │                                             │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ ⚠️ This will transfer all units (12),       │ │
│ │    tenants, and financial records.          │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│                [Cancel]  [Migrate Ownership]    │
│                                    ↑            │
│                               Disabled until    │
│                                form valid       │
└─────────────────────────────────────────────────┘
```

### Step 2: Filled Form

```
┌─────────────────────────────────────────────────┐
│ Migrate Building Ownership              [✕]    │
├─────────────────────────────────────────────────┤
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ Building: Sallyan House Main Building       │ │
│ │ Current Owner: Ram Sharma                   │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ New Owner *                                     │
│ ┌─────────────────────────────────────────────┐ │
│ │ Gita Sharma                          ▼     │ │ ← Selected
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Transfer Date *                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 2026-03-27                          📅      │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Transfer Notes (optional)                       │
│ ┌─────────────────────────────────────────────┐ │
│ │ Transferring building ownership as part    │ │
│ │ of estate restructuring.                   │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ ⚠️ This will transfer all units (12),       │ │
│ │    tenants, and financial records.          │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│                [Cancel]  [Migrate Ownership]    │
│                                    ↑            │
│                              Now enabled        │
└─────────────────────────────────────────────────┘
```

### Step 3: Loading State

```
┌─────────────────────────────────────────────────┐
│ Migrate Building Ownership              [✕]    │
├─────────────────────────────────────────────────┤
│                                                 │
│              ⏳ Processing migration...         │
│                                                 │
│         [███████████░░░░░░░░] 75%              │
│                                                 │
│     Please wait while we transfer ownership     │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Step 4: Success State

```
┌─────────────────────────────────────────────────┐
│ Migration Successful!                   [✕]    │
├─────────────────────────────────────────────────┤
│                                                 │
│                    ✅                           │
│                                                 │
│    Building ownership successfully transferred  │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ Building: Sallyan House Main Building       │ │
│ │ Previous Owner: Ram Sharma                  │ │
│ │ New Owner: Gita Sharma                      │ │
│ │ Transfer Date: 2026-03-27                   │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│                          [Close]                │
└─────────────────────────────────────────────────┘

+ Toast notification appears in corner:
┌─────────────────────────────────────┐
│ ✅ Building ownership migrated      │
│    successfully                     │
└─────────────────────────────────────┘
```

### Step 5: Error State

```
┌─────────────────────────────────────────────────┐
│ Migration Failed                        [✕]    │
├─────────────────────────────────────────────────┤
│                                                 │
│                    ❌                           │
│                                                 │
│       Failed to migrate building ownership      │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ Error: The selected user does not have      │ │
│ │ permission to own buildings.                │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│                [Cancel]  [Try Again]            │
└─────────────────────────────────────────────────┘

+ Toast notification:
┌─────────────────────────────────────┐
│ ❌ Failed to migrate ownership.     │
│    Please try again.                │
└─────────────────────────────────────┘
```

---

## 🎨 Active/Hover States

### Navigation Item States

#### Default
```
┌──────────────────────────────┐
│ [ ] 🏢 Buildings             │  Opacity: 1.0
└──────────────────────────────┘  Background: transparent
```

#### Hover
```
┌──────────────────────────────┐
│ [ ] 🏢 Buildings             │  Opacity: 1.0
└──────────────────────────────┘  Background: #F4F4F5 (light)
    ↑                              Cursor: pointer
 Pointer
```

#### Active/Current Page
```
┌──────────────────────────────┐
│ [|] 🏢 Buildings             │  Background: #18181B (light)
└──────────────────────────────┘  Color: #FAFAFA
    ↑                              Left indicator: Blue (#3B82F6)
 Blue ring
 (2px wide)
```

#### Focus (Keyboard)
```
┌──────────────────────────────┐
│ [ ] 🏢 Buildings             │  Outline: 2px blue
└──────────────────────────────┘  Outline offset: 2px
  ╰─── Blue outline
```

### Button States

#### Primary Button States
```
Default:
[  Migrate Ownership  ]  Background: Primary
                         Color: Primary-foreground

Hover:
[  Migrate Ownership  ]  Background: Primary/90
 ↑                       Transform: translateY(-1px)
Slightly lifted          Shadow: subtle

Active/Pressed:
[  Migrate Ownership  ]  Background: Primary/80
                         Transform: translateY(0)

Disabled:
[  Migrate Ownership  ]  Opacity: 0.5
                         Cursor: not-allowed
```

#### Outline Button States
```
Default:
[  View Details  ]  Border: 1px solid border-color
                    Background: transparent

Hover:
[  View Details  ]  Background: Accent
 ↑                  Color: Accent-foreground
Pointer

Active/Pressed:
[  View Details  ]  Background: Accent/80
```

### Card Hover States

```
Default Card:
┌─────────────────────────┐
│ 🏢 Building Name        │  Shadow: none
│ ...                     │  Border: 1px solid
└─────────────────────────┘  Transform: none

Hover Card:
┌─────────────────────────┐
│ 🏢 Building Name        │  Shadow: 0 4px 12px rgba(0,0,0,0.08)
│ ...                     │  Transform: translateY(-2px)
└─────────────────────────┘  Transition: 200ms ease
    ↑
 Lifted slightly
```

---

## 🎨 Color Palette

### Light Mode
```
Background:     #FFFFFF
Sidebar:        #FAFAFA
Border:         #E4E4E7
Text Primary:   #09090B
Text Muted:     #71717A
Accent:         #F4F4F5
Primary:        #18181B
Ring/Active:    #3B82F6
Success:        #22C55E
Warning:        #F59E0B
Error:          #EF4444
```

### Dark Mode
```
Background:     #09090B
Sidebar:        #18181B
Border:         #27272A
Text Primary:   #FAFAFA
Text Muted:     #A1A1AA
Accent:         #27272A
Primary:        #FAFAFA
Ring/Active:    #3B82F6
Success:        #22C55E
Warning:        #F59E0B
Error:          #EF4444
```

---

## 📏 Spacing Reference

```
┌──── 280px ────┐           ┌──────── Flexible ────────┐
│               │           │                          │
│   Sidebar     │           │    Main Content Area     │
│               │           │                          │
│   p-3 (12px)  │           │    p-6 (24px)            │
│               │           │                          │
│   space-y-4   │           │    space-y-6             │
│   (16px gap)  │           │    (24px gap)            │
│               │           │                          │
└───────────────┘           └──────────────────────────┘

Card padding: 24px (p-6)
Card gap: 16px (space-y-4)
Button padding: 8px 16px (px-4 py-2)
Input padding: 8px 12px (px-3 py-2)
```

---

**Document Status**: Complete  
**Last Updated**: March 27, 2026  
**Tools Used**: ASCII art, Tailwind CSS classes  
**Related**: NAVIGATION_DESIGN.md, VISUAL_DESIGN_SYSTEM.md
