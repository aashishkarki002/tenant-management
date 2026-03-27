# EasyManage Component Reference — Petrol Theme

Full copy-paste snippets for all major UI patterns. All use CSS variables from globals.css.

---

## Button Variants

```jsx
// Primary CTA
<button style={{
  backgroundColor: 'var(--color-accent)',
  color: '#ffffff',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  padding: '8px 16px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background-color 0.15s',
}} onMouseOver={e => e.target.style.backgroundColor = 'var(--color-accent-hover)'}
   onMouseOut={e => e.target.style.backgroundColor = 'var(--color-accent)'}>
  + Add Tenant
</button>

// Secondary / Outlined
<button style={{
  backgroundColor: 'transparent',
  color: 'var(--color-text-body)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: '8px 16px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
}}>
  Record Payment
</button>

// Ghost / Text
<button style={{
  backgroundColor: 'transparent',
  color: 'var(--color-accent)',
  border: 'none',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  padding: '4px 8px',
}}>
  View Details →
</button>

// Danger
<button style={{
  backgroundColor: 'var(--color-danger-bg)',
  color: 'var(--color-danger)',
  border: '1px solid var(--color-danger-border)',
  borderRadius: 'var(--radius-md)',
  padding: '8px 16px',
  fontSize: '14px',
  fontWeight: 600,
}}>
  Remove Tenant
</button>
```

---

## Status Badge

```jsx
const STATUS_STYLES = {
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
  pending: {
    bg: "var(--color-warning-bg)",
    text: "var(--color-warning)",
    border: "var(--color-warning-border)",
  },
  partial: {
    bg: "var(--color-info-bg)",
    text: "var(--color-info)",
    border: "var(--color-info-border)",
  },
  vacant: {
    bg: "var(--color-warning-bg)",
    text: "var(--color-warning)",
    border: "var(--color-warning-border)",
  },
  occupied: {
    bg: "var(--color-success-bg)",
    text: "var(--color-success)",
    border: "var(--color-success-border)",
  },
  active: {
    bg: "var(--color-accent-light)",
    text: "var(--color-accent)",
    border: "var(--color-accent-mid)",
  },
};

function StatusBadge({ status, label }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.active;
  return (
    <span
      style={{
        backgroundColor: s.bg,
        color: s.text,
        border: `1px solid ${s.border}`,
        borderRadius: "var(--radius-sm)",
        padding: "2px 8px",
        fontSize: "11px",
        fontWeight: 600,
        display: "inline-block",
      }}
    >
      {label}
    </span>
  );
}
```

---

## KPI Card

```jsx
function KpiCard({ label, value, sub, status, progress }) {
  const s = STATUS_STYLES[status] || {};
  return (
    <div
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-card)",
        padding: "20px",
      }}
    >
      {/* Label */}
      <div
        style={{
          color: "var(--color-text-sub)",
          fontSize: "12px",
          marginBottom: "6px",
        }}
      >
        {label}
      </div>
      {/* Value */}
      <div
        style={{
          color: "var(--color-text-strong)",
          fontSize: "24px",
          fontWeight: 700,
          marginBottom: "8px",
        }}
      >
        {value}
      </div>
      {/* Progress bar */}
      {progress !== undefined && (
        <div
          style={{
            height: "4px",
            backgroundColor: "var(--color-muted)",
            borderRadius: "2px",
            marginBottom: "8px",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              backgroundColor: s.text || "var(--color-accent)",
              borderRadius: "2px",
              transition: "width 0.4s ease",
            }}
          />
        </div>
      )}
      {/* Sub label */}
      {sub && (
        <span
          style={{
            backgroundColor: s.bg || "var(--color-surface)",
            color: s.text || "var(--color-text-sub)",
            border: `1px solid ${s.border || "var(--color-border)"}`,
            borderRadius: "var(--radius-sm)",
            padding: "2px 8px",
            fontSize: "11px",
            fontWeight: 600,
          }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}
```

---

## Card / Panel

```jsx
// Standard card
<div style={{
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-card)',
  padding: '20px',
}}>

// Raised card (modal, dropdown)
<div style={{
  backgroundColor: 'var(--color-surface-raised)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-modal)',
  padding: '24px',
}}>

// Card with header divider
<div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
    <h3 style={{ color: 'var(--color-text-strong)', fontSize: '14px', fontWeight: 600, margin: 0 }}>Card Title</h3>
  </div>
  <div style={{ padding: '20px' }}>
    {/* content */}
  </div>
</div>
```

---

## Table

```jsx
<div
  style={{
    backgroundColor: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
  }}
>
  <table style={{ width: "100%", borderCollapse: "collapse" }}>
    <thead>
      <tr style={{ backgroundColor: "var(--color-bg)" }}>
        {["Tenant", "Unit", "Rent", "Status", "Due Date"].map((h) => (
          <th
            key={h}
            style={{
              padding: "10px 16px",
              textAlign: "left",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--color-text-weak)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            {h}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row, i) => (
        <tr
          key={i}
          style={{
            borderBottom: "1px solid var(--color-border)",
            backgroundColor:
              selectedRow === i ? "var(--color-accent-light)" : "transparent",
            transition: "background-color 0.1s",
          }}
          onMouseOver={(e) =>
            (e.currentTarget.style.backgroundColor = "var(--color-bg)")
          }
          onMouseOut={(e) =>
            (e.currentTarget.style.backgroundColor =
              selectedRow === i ? "var(--color-accent-light)" : "transparent")
          }
        >
          <td
            style={{
              padding: "12px 16px",
              fontSize: "14px",
              color: "var(--color-text-body)",
            }}
          >
            {row.name}
          </td>
          {/* etc */}
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

---

## Sidebar Navigation

```jsx
function Sidebar() {
  const navGroups = [
    {
      label: "PEOPLE",
      items: [
        { id: "dashboard", icon: "⊞", label: "Dashboard" },
        { id: "tenants", icon: "👤", label: "Tenants" },
        { id: "units", icon: "🏠", label: "Units" },
      ],
    },
    {
      label: "MONEY",
      items: [
        { id: "rent", icon: "₹", label: "Rent & Payments" },
        { id: "accounting", icon: "📊", label: "Accounting" },
        { id: "cheques", icon: "📄", label: "Cheque Drafts" },
      ],
    },
    {
      label: "BUILDING",
      items: [
        { id: "maintenance", icon: "🔧", label: "Maintenance" },
        { id: "electricity", icon: "⚡", label: "Electricity" },
      ],
    },
  ];

  return (
    <aside
      style={{
        width: "200px",
        backgroundColor: "var(--color-surface)",
        borderRight: "1px solid var(--color-border)",
        height: "100vh",
        padding: "16px 8px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      {navGroups.map((group) => (
        <div key={group.label}>
          <div
            style={{
              color: "var(--color-text-weak)",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "0 8px",
              marginBottom: "6px",
            }}
          >
            {group.label}
          </div>
          {group.items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "7px 10px",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                backgroundColor:
                  active === item.id
                    ? "var(--color-accent-light)"
                    : "transparent",
                color:
                  active === item.id
                    ? "var(--color-accent)"
                    : "var(--color-text-sub)",
                fontWeight: active === item.id ? 600 : 400,
                fontSize: "13px",
                borderLeft:
                  active === item.id
                    ? "3px solid var(--color-accent)"
                    : "3px solid transparent",
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      ))}
    </aside>
  );
}
```

---

## Form Inputs (Formik + shadcn override)

```jsx
// In the component — use className to apply override
<input
  className="shadcn-input-override"
  style={{
    backgroundColor: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    padding: "8px 12px",
    fontSize: "14px",
    color: "var(--color-text-body)",
    width: "100%",
    outline: "none",
  }}
  onFocus={(e) => (e.target.style.borderColor = "var(--color-accent)")}
  onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
/>;

// Formik error state
{
  formik.errors.fieldName && formik.touched.fieldName && (
    <span
      style={{
        color: "var(--color-danger)",
        fontSize: "12px",
        marginTop: "4px",
        display: "block",
      }}
    >
      {formik.errors.fieldName}
    </span>
  );
}
```

---

## Modal / Dialog

```jsx
// Overlay
<div
  style={{
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(28, 25, 23, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  }}
>
  {/* Modal */}
  <div
    style={{
      backgroundColor: "var(--color-surface-raised)",
      border: "1px solid var(--color-border)",
      borderRadius: "var(--radius-xl)",
      boxShadow: "var(--shadow-modal)",
      padding: "24px",
      width: "100%",
      maxWidth: "520px",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px",
      }}
    >
      <h2
        style={{
          color: "var(--color-text-strong)",
          fontSize: "18px",
          fontWeight: 700,
          margin: 0,
        }}
      >
        Dialog Title
      </h2>
      <button
        style={{
          color: "var(--color-text-weak)",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "18px",
        }}
      >
        ✕
      </button>
    </div>
    {/* content */}
    <div
      style={{
        display: "flex",
        gap: "8px",
        justifyContent: "flex-end",
        marginTop: "24px",
      }}
    >
      {/* Secondary */}
      <button
        style={{
          backgroundColor: "transparent",
          color: "var(--color-text-body)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          padding: "8px 16px",
          fontSize: "14px",
          fontWeight: 500,
        }}
      >
        Cancel
      </button>
      {/* Primary */}
      <button
        style={{
          backgroundColor: "var(--color-accent)",
          color: "#fff",
          border: "none",
          borderRadius: "var(--radius-md)",
          padding: "8px 16px",
          fontSize: "14px",
          fontWeight: 600,
        }}
      >
        Confirm
      </button>
    </div>
  </div>
</div>
```

---

## Section Label (category headers)

```jsx
<p
  style={{
    color: "var(--color-text-weak)",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: "12px",
  }}
>
  Section Label
</p>
```

---

## Empty State

```jsx
<div
  style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 24px",
    textAlign: "center",
  }}
>
  <div style={{ fontSize: "32px", marginBottom: "12px", opacity: 0.4 }}>📋</div>
  <div
    style={{
      color: "var(--color-text-body)",
      fontSize: "14px",
      fontWeight: 600,
      marginBottom: "4px",
    }}
  >
    No data yet
  </div>
  <div
    style={{
      color: "var(--color-text-sub)",
      fontSize: "13px",
      marginBottom: "16px",
    }}
  >
    Description of what goes here
  </div>
  {/* Optional CTA */}
  <button
    style={{
      backgroundColor: "var(--color-accent)",
      color: "#fff",
      border: "none",
      borderRadius: "var(--radius-md)",
      padding: "8px 16px",
      fontSize: "13px",
      fontWeight: 600,
    }}
  >
    Add First Item
  </button>
</div>
```
