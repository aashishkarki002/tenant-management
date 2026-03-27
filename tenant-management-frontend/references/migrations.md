# EasyManage Migration Map — Old Colors → Petrol Tokens

Use this when auditing existing components. Find the old value in the left column,
replace with the CSS variable in the right column.

---

## Tailwind Class Replacements

### Backgrounds

| Old Tailwind class | New CSS variable                                   | Notes                                    |
| ------------------ | -------------------------------------------------- | ---------------------------------------- |
| `bg-white`         | `var(--color-bg)` or `var(--color-surface-raised)` | bg for canvas, surface-raised for modals |
| `bg-gray-50`       | `var(--color-bg)`                                  | Page canvas                              |
| `bg-gray-100`      | `var(--color-surface)`                             | Cards, panels                            |
| `bg-gray-200`      | `var(--color-muted)`                               | Only for skeletons/fills                 |
| `bg-stone-50`      | `var(--color-bg)`                                  |                                          |
| `bg-stone-100`     | `var(--color-surface)`                             |                                          |
| `bg-slate-50`      | `var(--color-bg)`                                  |                                          |
| `bg-slate-100`     | `var(--color-surface)`                             |                                          |
| `bg-blue-600`      | `var(--color-accent)`                              | If used as CTA                           |
| `bg-blue-50`       | `var(--color-accent-light)`                        | If used as active bg                     |
| `bg-green-100`     | `var(--color-success-bg)`                          |                                          |
| `bg-red-100`       | `var(--color-danger-bg)`                           |                                          |
| `bg-yellow-100`    | `var(--color-warning-bg)`                          |                                          |
| `bg-orange-100`    | `var(--color-warning-bg)`                          |                                          |

### Text

| Old Tailwind class | New CSS variable           |
| ------------------ | -------------------------- |
| `text-gray-900`    | `var(--color-text-strong)` |
| `text-gray-800`    | `var(--color-text-strong)` |
| `text-gray-700`    | `var(--color-text-body)`   |
| `text-gray-600`    | `var(--color-text-sub)`    |
| `text-gray-500`    | `var(--color-text-sub)`    |
| `text-gray-400`    | `var(--color-text-weak)`   |
| `text-gray-300`    | `var(--color-text-weak)`   |
| `text-stone-900`   | `var(--color-text-strong)` |
| `text-stone-700`   | `var(--color-text-body)`   |
| `text-stone-500`   | `var(--color-text-sub)`    |
| `text-stone-400`   | `var(--color-text-weak)`   |
| `text-slate-900`   | `var(--color-text-strong)` |
| `text-slate-600`   | `var(--color-text-sub)`    |
| `text-blue-600`    | `var(--color-accent)`      |
| `text-blue-700`    | `var(--color-accent)`      |
| `text-green-700`   | `var(--color-success)`     |
| `text-green-800`   | `var(--color-success)`     |
| `text-red-700`     | `var(--color-danger)`      |
| `text-red-800`     | `var(--color-danger)`      |
| `text-yellow-700`  | `var(--color-warning)`     |
| `text-orange-700`  | `var(--color-warning)`     |

### Borders

| Old Tailwind class  | New CSS variable              |
| ------------------- | ----------------------------- |
| `border-gray-200`   | `var(--color-border)`         |
| `border-gray-300`   | `var(--color-border)`         |
| `border-stone-200`  | `var(--color-border)`         |
| `border-slate-200`  | `var(--color-border)`         |
| `border-blue-300`   | `var(--color-accent-mid)`     |
| `border-green-200`  | `var(--color-success-border)` |
| `border-red-200`    | `var(--color-danger-border)`  |
| `border-yellow-200` | `var(--color-warning-border)` |

---

## Hardcoded Hex Replacements

| Old hex   | New CSS variable              | Role                                |
| --------- | ----------------------------- | ----------------------------------- |
| `#ffffff` | `var(--color-surface-raised)` | Modal/dropdown bg only              |
| `#f9fafb` | `var(--color-bg)`             | Page canvas                         |
| `#f3f4f6` | `var(--color-surface)`        | Card surface                        |
| `#e5e7eb` | `var(--color-border)`         | Borders                             |
| `#d1d5db` | `var(--color-muted)`          | Muted fills                         |
| `#9ca3af` | `var(--color-text-weak)`      | Weak text                           |
| `#6b7280` | `var(--color-text-sub)`       | Sub text                            |
| `#374151` | `var(--color-text-body)`      | Body text                           |
| `#111827` | `var(--color-text-strong)`    | Strong text                         |
| `#2563eb` | `var(--color-accent)`         | CTA / accent                        |
| `#1d4ed8` | `var(--color-accent)`         | CTA / accent                        |
| `#dbeafe` | `var(--color-accent-light)`   | Accent bg                           |
| `#3b82f6` | `var(--color-accent)`         | CTA / accent                        |
| `#16a34a` | `var(--color-success)`        | Success text                        |
| `#dcfce7` | `var(--color-success-bg)`     | Success bg                          |
| `#dc2626` | `var(--color-danger)`         | Danger text                         |
| `#fee2e2` | `var(--color-danger-bg)`      | Danger bg                           |
| `#d97706` | `var(--color-warning)`        | Warning text                        |
| `#fef9c3` | `var(--color-warning-bg)`     | Warning bg                          |
| `#b45309` | `var(--color-warning)`        | Old amber accent → now warning only |
| `#fef3c7` | `var(--color-warning-bg)`     | Old amber light                     |

---

## Amber Accent Removal (Previous Theme)

The previous theme used amber (`#b45309`) as the brand accent.
Amber is now **only** used as warning semantic color. Migrate all amber accent usage:

| Old usage                   | New replacement                                             | Why                                 |
| --------------------------- | ----------------------------------------------------------- | ----------------------------------- |
| CTA buttons with amber bg   | `var(--color-accent)` — petrol `#1A5276`                    | Amber = hospitality, not management |
| Active nav items with amber | `var(--color-accent-light)` bg + `var(--color-accent)` text |                                     |
| Focus rings amber           | `var(--color-accent)`                                       |                                     |
| `bg-amber-700` on buttons   | `var(--color-accent)`                                       |                                     |
| `text-amber-700` on links   | `var(--color-accent)`                                       | Unless it's a warning state         |
| `bg-amber-100` as active bg | `var(--color-accent-light)`                                 |                                     |
| `border-amber-*` on accent  | `var(--color-accent-mid)`                                   |                                     |

**Exception**: `bg-amber-*` / `text-amber-*` used for "due soon" or "approaching deadline"
states should be migrated to `var(--color-warning-*)` tokens, not accent tokens.

---

## shadcn Component-Specific Fixes

### `<Input>` — often overrides with white background

```jsx
// Before (common shadcn default)
className="bg-white border-gray-300 focus:ring-blue-500"

// After — use shadcn token mapping (should auto-resolve after globals.css update)
// If not resolving, add explicit override:
style={{
  backgroundColor: 'var(--color-surface)',
  borderColor: 'var(--color-border)',
}}
```

### `<Badge>` — check variant prop

```jsx
// shadcn Badge variant="default" will pick up --primary → var(--color-accent) ✓
// shadcn Badge variant="destructive" will pick up --destructive → var(--color-danger) ✓
// shadcn Badge variant="secondary" will pick up --muted → var(--color-surface) ✓
// shadcn Badge variant="outline" uses --border → var(--color-border) ✓
```

### `<Tabs>` — if replaced with useState pattern

EasyManage dashboard replaced shadcn Tabs with custom useState rendering.
Active tab indicator uses: `borderBottom: '2px solid var(--color-accent)'`
Active tab text: `var(--color-accent)`, fontWeight 600
Inactive tab text: `var(--color-text-sub)`

### `<Select>` dropdown

Dropdown panel: `backgroundColor: 'var(--color-surface-raised)'`
Selected item bg: `var(--color-accent-light)`
Hover item bg: `var(--color-bg)`

---

## Common Mistakes to Avoid

1. **Don't use `--color-accent` for status states** — success/warning/danger have their own tokens
2. **Don't use `bg-white`** — use `var(--color-surface-raised)` for modals, `var(--color-surface)` for cards
3. **Don't mix old amber accent with new petrol** — audit for any remaining `amber-700` usage
4. **Don't forget the shadcn token mapping block** — without it, shadcn components won't inherit the theme
5. **Don't use `text-gray-*` classes** — replace with the 4-level token hierarchy
6. **Danger ≠ Vacant** — vacancy is `--color-warning-*`, not danger
