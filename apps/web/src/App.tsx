import "./styles/tokens.css";

export default function App() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh" }}>
      <aside style={{ borderRight: "1px solid var(--color-border)", padding: "var(--space-3)" }}>
        <h2 style={{ marginTop: 0 }}>RMS</h2>
        <nav style={{ display: "grid", gap: "var(--space-1)" }}>
          <a href="#">Dashboard</a>
          <a href="#">Expenses</a>
          <a href="#">Approvals</a>
          <a href="#">Reports</a>
          <a href="#">Settings</a>
        </nav>
      </aside>
      <main style={{ padding: "var(--space-3)" }}>
        <header
          style={{
            background: "var(--color-primary-soft)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-2)",
            marginBottom: "var(--space-3)"
          }}
        >
          <strong>Reimbursement Management System</strong>
        </header>
        <section>
          <h1>Implementation Scaffold Ready</h1>
          <p>API contracts, schema, docs, and design tokens are now in the repository.</p>
        </section>
      </main>
    </div>
  );
}
