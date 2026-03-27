---
name: easymanage-petrol-theme
description: >
  Design system and migration guide for EasyManage — a React/Tailwind/shadcn property management app.
  Use this skill whenever working on ANY UI component, page, layout, or styling task in EasyManage,
  including new components, refactors, bug fixes, color changes, or theme migrations.
  Also use when the user asks to "apply the theme", "migrate to petrol", "fix styling", "match the design system",
  or any time a .jsx/.tsx file in EasyManage is being created or edited. This skill defines the single
  source of truth for all design tokens, component patterns, and migration rules.
---

# EasyManage Design System — Petrol Theme

## Stack

- React (functional components + hooks)
- Tailwind CSS (utility classes only — no arbitrary values unless specified below)
- shadcn/ui components
- Formik for forms
- The app uses **Nepali calendar** (BS years, Nepali month names) throughout

---

## 1. Design Token System

All tokens are defined as CSS variables in `globals.css`. **Never hardcode hex values in components.**
Always use `var(--token-name)` in inline styles, or the mapped Tailwind class where available.

### Full Token Reference

```css
/* globals.css */
:root {
  /* ── Surfaces ── */
  --color-bg: #fafaf8; /* Page canvas — warm stone-50 */
  --color-surface: #f5f4f0; /* Cards, panels, sidebar */
  --color-surface-raised: #ffffff; /* Modals, dropdowns (elevated) */
  --color-border: #e7e5e0; /* All borders, dividers */
  --color-muted: #d6d3cc; /* Progress fills, skeleton loaders */

  /* ── Text Hierarchy (4 levels — use strictly) ── */
  --color-text-strong: #1c1917; /* Page titles, KPI values, headings */
  --color-text-body: #44403c; /* Body copy, labels, descriptions */
  --color-text-sub: #78716c; /* Metadata, timestamps, secondary info */
  --color-text-weak: #a8a29e; /* Placeholders, disabled, captions */

  /* ── Brand Accent: Petrol ── */
  --color-accent: #1a5276; /* CTAs, active nav, links, focus rings */
  --color-accent-mid: #aed6f1; /* Borders on accent backgrounds */
  --color-accent-light: #ebf5fb; /* Active state bg, tags, selected rows */
  --color-accent-hover: #154360; /* Hover state for accent buttons */

  /* ── Semantic: Success (paid, occupied, on-time) ── */
  --color-success: #166534;
  --color-success-bg: #dcfce7;
  --color-success-border: #bbf7d0;

  /* ── Semantic: Warning (vacant, approaching due) ── */
  --color-warning: #92400e;
  --color-warning-bg: #fef9c3;
  --color-warning-border: #fde68a;

  /* ── Semantic: Danger (overdue, unpaid, critical) ── */
  --color-danger: #991b1b;
  --color-danger-bg: #fee2e2;
  --color-danger-border: #fecaca;

  /* ── Semantic: Info (neutral notices) ── */
  --color-info: #1e40af;
  --color-info-bg: #dbeafe;
  --color-info-border: #bfdbfe;

  /* ── Shadows ── */
  --shadow-card:
    0 1px 3px rgba(28, 25, 23, 0.06), 0 1px 2px rgba(28, 25, 23, 0.04);
  --shadow-modal: 0 10px 40px rgba(28, 25, 23, 0.12);

  /* ── Radius ── */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 18px;
}
```

---

## 2. Semantic Color Rules — Enforce Strictly

| State   | Text token        | Background token       | Use case                                   |
| ------- | ----------------- | ---------------------- | ------------------------------------------ |
| Success | `--color-success` | `--color-success-bg`   | Paid rent, occupied units, on-time tenants |
| Warning | `--color-warning` | `--color-warning-bg`   | Vacant units, rent due soon, pending       |
| Danger  | `--color-danger`  | `--color-danger-bg`    | Overdue rent, unpaid, lease expired        |
| Info    | `--color-info`    | `--color-info-bg`      | Neutral notices, system messages           |
| Accent  | `--color-accent`  | `--color-accent-light` | Active nav items, selected rows, CTAs      |

**Never use danger color for vacant units** — vacancy is a warning (opportunity), not an error.
**Never use accent color for semantic states** — accent is reserved for interactivity only.

---

## 3. Typography Rules

Font: `'DM Sans', sans-serif` — add to `index.html` via Google Fonts.

```html
<link
  href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
  rel="stylesheet"
/>
```

| Role               | Size        | Weight | Token                 |
| ------------------ | ----------- | ------ | --------------------- |
| Page title         | `text-2xl`  | 700    | `--color-text-strong` |
| Section heading    | `text-base` | 600    | `--color-text-strong` |
| KPI value          | `text-2xl`  | 700    | `--color-text-strong` |
| Body / label       | `text-sm`   | 400    | `--color-text-body`   |
| Subtext / meta     | `text-xs`   | 400    | `--color-text-sub`    |
| Caption / disabled | `text-xs`   | 400    | `--color-text-weak`   |

---

## 4. Component Patterns

See `references/components.md` for full component code snippets.

### Quick Reference

**Primary Button (CTA)**

```jsx
<button
  style={{
    backgroundColor: "var(--color-accent)",
    color: "#fff",
    borderRadius: "var(--radius-md)",
    padding: "8px 16px",
    fontSize: "14px",
    fontWeight: 600,
  }}
>
  + Add Tenant
</button>
```

**Status Badge / Chip**

```jsx
// Use semantic tokens based on state
const badgeStyle = (status) =>
  ({
    paid: {
      bg: "var(--color-success-bg)",
      text: "var(--color-success)",
      border: "var(--color-success-border)",
    },
    overdue: {
      bg: "var(--color-danger-bg)",
      text: "var(--color-danger)",
      border: "var(--color-danger-border)",
    },
    vacant: {
      bg: "var(--color-warning-bg)",
      text: "var(--color-warning)",
      border: "var(--color-warning-border)",
    },
    active: {
      bg: "var(--color-accent-light)",
      text: "var(--color-accent)",
      border: "var(--color-accent-mid)",
    },
  })[status];
```

**Card**

```jsx
<div style={{
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-card)',
  padding: '20px',
}}>
```

**Active Nav Item**

```jsx
// Active
{ backgroundColor: 'var(--color-accent-light)', color: 'var(--color-accent)', fontWeight: 600 }
// Inactive
{ color: 'var(--color-text-sub)' }
```

**Table Row — Selected**

```jsx
{ backgroundColor: 'var(--color-accent-light)', borderLeft: '3px solid var(--color-accent)' }
```

**Input (shadcn override)**

```css
/* In globals.css — fixes shadcn CSS variable conflicts */
.shadcn-input-override {
  --background: var(--color-surface);
  --border: var(--color-border);
  --ring: var(--color-accent);
  --foreground: var(--color-text-body);
}
```

---

## 5. shadcn/ui Integration

shadcn uses its own CSS variable names (`--background`, `--foreground`, `--primary`, etc.).
Map them in `globals.css` so shadcn components inherit the petrol theme automatically:

```css
/* shadcn token mapping — add to globals.css after the :root block */
:root {
  --background: var(--color-bg);
  --foreground: var(--color-text-strong);
  --card: var(--color-surface);
  --card-foreground: var(--color-text-body);
  --border: var(--color-border);
  --input: var(--color-border);
  --ring: var(--color-accent);
  --primary: var(--color-accent);
  --primary-foreground: #ffffff;
  --muted: var(--color-surface);
  --muted-foreground: var(--color-text-sub);
  --accent: var(--color-accent-light);
  --accent-foreground: var(--color-accent);
  --destructive: var(--color-danger);
  --destructive-foreground: #ffffff;
}
```

After adding this block, shadcn `<Button>`, `<Input>`, `<Badge>`, `<Card>`, `<Select>`,
`<Dialog>`, `<Tabs>` etc. will all inherit petrol theme without per-component overrides.

---

## 6. Migration Checklist

When migrating any existing component to the petrol theme, follow this order:

**Step 1 — Audit existing colors**
Search the file for: hardcoded hex values, Tailwind color classes (`bg-blue-*`, `text-gray-*`, `border-slate-*`),
and inline `style={{}}` color props. List them all before changing anything.

**Step 2 — Map old → new**
Use `references/migration-map.md` for the complete old-to-new color mapping table.

**Step 3 — Replace surfaces first**
Background → `var(--color-bg)`
Cards/panels → `var(--color-surface)`
Borders → `var(--color-border)`

**Step 4 — Replace text**
Map all text colors to the 4-level hierarchy (strong / body / sub / weak).

**Step 5 — Replace interactive elements**
All CTAs, active states, focus rings → accent tokens.

**Step 6 — Replace semantic states**
Status badges, progress bars, KPI indicators → semantic tokens.
Check that danger/warning/success are used correctly per the rules in Section 2.

**Step 7 — Verify shadcn components**
Check that shadcn components are picking up the mapped variables. If a component still shows
old colors, add the explicit override class `shadcn-input-override` or check the mapping block.

**Step 8 — Test responsive**
Verify on mobile that no hardcoded dark backgrounds remain in the header slot or sidebar.

---

## 7. Key App-Specific Patterns

### KPI Cards (Dashboard)

- 4-card strip: Collected · Unpaid Rent · Vacant Units · Late Fees
- Values in `--color-text-strong`, size `text-2xl font-bold`
- Sub-labels in `--color-text-sub`, size `text-xs`
- Status chip below value uses semantic tokens (not accent)
- Progress bar fill: use semantic token matching card state

### Rent Status Chips

| Status  | Background           | Text              |
| ------- | -------------------- | ----------------- |
| Paid    | `--color-success-bg` | `--color-success` |
| Overdue | `--color-danger-bg`  | `--color-danger`  |
| Pending | `--color-warning-bg` | `--color-warning` |
| Partial | `--color-info-bg`    | `--color-info`    |

### Sidebar / Nav

- Sidebar background: `var(--color-surface)`
- Active item: `var(--color-accent-light)` background, `var(--color-accent)` text + left border `3px solid var(--color-accent)`
- Inactive: `var(--color-text-sub)` text, transparent background
- Section labels (PEOPLE, MONEY, BUILDING): `var(--color-text-weak)`, `text-xs tracking-widest uppercase`

### Header

- Background: `var(--color-surface)`
- Border-bottom: `1px solid var(--color-border)`
- Primary CTA: accent button
- Secondary CTA: outlined, `border: 1px solid var(--color-border)`, text `var(--color-text-body)`

### Nepali Calendar

- BS year labels: treat as standard text — `var(--color-text-sub)`
- Month names in charts: `var(--color-text-weak)` for inactive, `var(--color-text-body)` for active/current

---

## 8. Reference Files

- `references/components.md` — Full copy-paste component snippets for all major UI patterns
- `references/migration-map.md` — Complete old color → new token mapping table

Read these when you need full implementation detail beyond the quick reference above.
