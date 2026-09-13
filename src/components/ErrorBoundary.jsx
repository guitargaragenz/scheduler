import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 32, background: '#0f172a', color: '#f87171',
          fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap',
          height: '100vh', overflow: 'auto',
        }}>
          <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: 16, marginBottom: 12 }}>
            ⚠ Runtime Error — copy this and send to dev
          </div>
          <div style={{ color: '#ef4444', marginBottom: 8 }}>{this.state.error.message}</div>
          <div style={{ color: '#64748b' }}>{this.state.error.stack}</div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 20, padding: '8px 20px', background: '#1e293b',
              border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0',
              cursor: 'pointer', fontSize: 13,
            }}
          >
            Try to recover
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
