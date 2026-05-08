export function ChatLayout() {
  return (
    <main
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(220px, 320px) 1fr',
        minHeight: '100vh',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#0f172a'
      }}
    >
      <aside style={{ borderRight: '1px solid #e5e7eb', padding: 16 }}>
        <strong>Conversations</strong>
        <p style={{ color: '#64748b' }}>All / Mine / Unassigned</p>
      </aside>
      <section style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto' }}>
        <div style={{ background: '#fff7ed', color: '#9a3412', padding: 12 }}>Zalo disconnected</div>
        <div style={{ display: 'grid', placeItems: 'center', color: '#64748b', padding: 24 }}>
          Select a conversation
        </div>
        <form style={{ borderTop: '1px solid #e5e7eb', padding: 16 }}>
          <input
            aria-label="Message"
            placeholder="Type a message"
            style={{ boxSizing: 'border-box', width: '100%', padding: 12 }}
          />
        </form>
      </section>
    </main>
  );
}
