# Visual Design System
## Tenant Management SaaS UI Components

---

## 🎨 Color System

### CSS Variables

```css
/* Light Mode */
--sidebar: 0 0% 98%;                    /* #FAFAFA */
--sidebar-foreground: 240 10% 3.9%;     /* #09090B */
--sidebar-border: 220 13% 91%;          /* #E4E4E7 */
--sidebar-accent: 240 4.8% 95.9%;       /* #F4F4F5 */
--sidebar-accent-foreground: 240 5.9% 10%; /* #18181B */
--sidebar-primary: 240 5.9% 10%;        /* #18181B */
--sidebar-primary-foreground: 0 0% 98%; /* #FAFAFA */
--sidebar-ring: 217 91% 60%;            /* #3B82F6 (blue-500) */

/* Dark Mode */
--sidebar: 240 5.9% 10%;                /* #18181B */
--sidebar-foreground: 0 0% 98%;         /* #FAFAFA */
--sidebar-border: 240 3.7% 15.9%;       /* #27272A */
--sidebar-accent: 240 3.7% 15.9%;       /* #27272A */
--sidebar-accent-foreground: 0 0% 98%;  /* #FAFAFA */
--sidebar-primary: 0 0% 98%;            /* #FAFAFA */
--sidebar-primary-foreground: 240 5.9% 10%; /* #18181B */
--sidebar-ring: 217 91% 60%;            /* #3B82F6 */
```

---

## 📐 Component Anatomy

### Navigation Item Structure

```
┌─────────────────────────────────────┐
│ [ring] [icon] Label        [badge]  │
└─────────────────────────────────────┘
   2px   14px   13px          10px
   w-0.5 w-3.5  font-medium   text-xs
```

### Spacing System

```
Sidebar padding:    12px (p-3)
Group spacing:      16px (space-y-4)
Item gap:           4px (gap-1)
Icon-text gap:      10px (gap-2.5)
Section padding:    10px (px-2.5 py-1.5)
```

---

## 🎯 Interactive States

### Navigation Item States

#### 1. Default (Inactive)
```css
background: transparent
color: var(--sidebar-foreground)
opacity: 1

/* Left ring */
background: transparent
width: 2px

/* Transition */
transition: colors 200ms ease-in-out
```

#### 2. Hover
```css
background: var(--sidebar-accent)         /* #F4F4F5 light / #27272A dark */
color: var(--sidebar-accent-foreground)
cursor: pointer

/* No left ring change */
```

#### 3. Active (Current Page)
```css
background: var(--sidebar-primary)        /* #18181B light / #FAFAFA dark */
color: var(--sidebar-primary-foreground)  /* #FAFAFA light / #18181B dark */

/* Left ring appears */
background: var(--sidebar-ring)           /* #3B82F6 blue */
width: 2px
height: 16px
border-radius: 9999px
```

#### 4. Focus (Keyboard Navigation)
```css
outline: 2px solid var(--sidebar-ring)
outline-offset: 2px
```

---

## 🏷️ Typography Scale

### Group Labels
```css
font-size: 9px
font-weight: 500-600
letter-spacing: 0.24em (tracking-[0.24em])
text-transform: uppercase
opacity: 0.6
margin-bottom: 6px
```

### Navigation Labels
```css
font-size: 13px
font-weight: 500 (font-medium)
letter-spacing: 0
line-height: 1.5
```

### Page Titles
```css
font-size: 24px (text-2xl)
font-weight: 600 (font-semibold)
letter-spacing: -0.025em (tracking-tight)
```

### Descriptions
```css
font-size: 14px (text-sm)
color: var(--muted-foreground)
margin-top: 4px
```

---

## 🖼️ Visual Hierarchy Examples

### Sidebar Layout

```
┌────────────────────────────────────┐
│ [Logo] Sallyan House               │ ← Brand (14px height)
│        MANAGEMENT                   │   Subtext (10px, uppercase)
├────────────────────────────────────┤
│                                     │
│ [●] Dashboard                       │ ← Primary (ungrouped)
│                                     │
│ CORE                                │ ← Group label (9px, uppercase)
│ [■] Buildings                       │
│ [ ] Units                           │
│ [ ] Tenants                         │
│                                     │
│ FINANCE                             │ ← Group label (primary color)
│ [ ] Rent & Payments                 │
│ [ ] Accounting                      │
│                                     │
│ OPERATIONS                          │
│ [ ] Daily Checks        [Today]     │ ← Badge highlight
│ [ ] Maintenance                     │
│                                     │
│ UTILITIES                           │
│ [ ] Electricity                     │
│                                     │
│ MORE                      ▼         │ ← Collapsible
│                                     │
├────────────────────────────────────┤
│ [Avatar] Ram Sharma        ▼       │ ← User menu
│          admin@example.com         │
└────────────────────────────────────┘
```

---

## 🎴 Building Card Design

### Card Anatomy

```
┌─────────────────────────────────────────────┐
│ ┌───┐ Building Name                         │ ← Header
│ │ 🏢│ Location with icon                    │   48px height
│ └───┘                                        │
│                                              │
│ 🏠 12 units    👥 10 occupied               │ ← Stats grid
│                                              │
│ [Fully Occupied]                            │ ← Badge
│                                              │
│ ┌──────────────────────────────────────┐   │
│ │ Current Owner                         │   │ ← Owner card
│ │ Ram Sharma                            │   │   (muted bg)
│ └──────────────────────────────────────┘   │
│                                              │
│ [View Details]  [Migrate Ownership]         │ ← Actions
└─────────────────────────────────────────────┘
```

### Card States

```css
/* Default */
border: 1px solid var(--border)
box-shadow: none
transition: shadow 200ms ease

/* Hover */
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08)
transform: translateY(-1px)
transition: all 200ms ease
```

---

## 🎨 Badge Variants

### Status Badges

```css
/* Fully Occupied (Success) */
background: var(--primary)
color: var(--primary-foreground)
padding: 2px 8px
border-radius: 6px
font-size: 12px

/* Has Vacancies (Secondary) */
background: var(--secondary)
color: var(--secondary-foreground)

/* Time-sensitive (Today) */
background: #22C55E (green-500)
color: white
padding: 2px 6px
font-size: 10px
```

---

## 🔘 Button Styles

### Primary Button
```css
background: var(--primary)
color: var(--primary-foreground)
padding: 8px 16px
border-radius: 6px
font-weight: 500

/* Hover */
background: var(--primary) / 90%
```

### Outline Button
```css
border: 1px solid var(--border)
background: transparent
color: var(--foreground)

/* Hover */
background: var(--accent)
color: var(--accent-foreground)
```

### Ghost Button
```css
background: transparent
color: var(--foreground)

/* Hover */
background: var(--accent)
color: var(--accent-foreground)
```

---

## 📱 Responsive Behavior

### Mobile (< 768px)
- Sidebar becomes overlay
- Full-width cards (1 column)
- Compact padding (p-4)
- Larger touch targets (min-height: 44px)

### Tablet (768px - 1024px)
- Sidebar remains visible
- 1-2 column card grid
- Standard padding (p-6)

### Desktop (> 1024px)
- Sidebar pinned
- 2-3 column card grid
- Full spacing system

---

## 🎭 Animation Principles

### Micro-interactions

```css
/* Smooth transitions */
transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1)

/* Hover lift */
transform: translateY(-2px)
transition: transform 150ms ease

/* Collapse/Expand */
max-height: 0 → max-height: 160px
transition: max-height 300ms ease-in-out

/* Fade in */
opacity: 0 → opacity: 1
transition: opacity 200ms ease
```

---

## 🎯 Accessibility

### Focus States
```css
/* Keyboard focus */
outline: 2px solid var(--ring)
outline-offset: 2px
border-radius: inherit
```

### Contrast Ratios
- Text on background: >= 4.5:1
- Interactive elements: >= 3:1
- Icons: >= 3:1

### Touch Targets
- Minimum size: 44x44px (mobile)
- Spacing between targets: >= 8px

---

## 🖌️ Icon Guidelines

### Icon Library
**Lucide Icons** - Consistent, modern, open-source

### Icon Sizing
```css
/* Sidebar icons */
width: 14px (w-3.5)
height: 14px (h-3.5)
stroke-width: 2px

/* Card icons */
width: 16px (w-4)
height: 16px (h-4)

/* Large feature icons */
width: 20px (w-5)
height: 20px (h-5)
```

### Icon Colors
- Inherit from parent by default
- Use `text-muted-foreground` for secondary icons
- Use `text-primary` for branded icons

---

## 📊 Data Visualization

### Stats Display
```
┌─────────────────────┐
│ Label (12px, muted) │
│ Value (24px, bold)  │
└─────────────────────┘
```

### Progress Indicators
```css
/* Occupancy bar */
height: 4px
border-radius: 2px
background: var(--muted)

/* Fill */
background: var(--primary)
transition: width 300ms ease
```

---

## 🎨 Design Tokens (Tailwind)

```javascript
// Component-specific tokens
const tokens = {
  sidebar: {
    width: "280px",
    padding: "12px",
    itemHeight: "36px",
    itemRadius: "6px",
    groupSpacing: "16px",
  },
  
  card: {
    padding: "24px",
    radius: "8px",
    gap: "16px",
  },
  
  typography: {
    groupLabel: "text-[9px] font-medium tracking-[0.24em] uppercase",
    navItem: "text-[13px] font-medium",
    heading: "text-2xl font-semibold tracking-tight",
    body: "text-sm",
  },
}
```

---

**Reference**: Inspired by shadcn/ui, Radix UI, and modern SaaS applications  
**Last Updated**: March 27, 2026
