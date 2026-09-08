import { Component, Suspense, useEffect, useState, type ReactNode } from "react";
import { reloadApplication } from "../appRecovery";

function LoadStatus({ title, error }: { title: string; error?: Error }) {
  const [slow, setSlow] = useState(false);
  const [reloading, setReloading] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(timer);
  }, []);
  return <div className={`sands-surface sands-loading sands-load-status${error ? " is-failed" : ""}`} role="status">
    <h1>{title}</h1>
    <p>{error ? "游戏未能加载，请重新加载后再试。" : slow ? "加载时间较长，可以重新加载后再试。" : "正在加载…"}</p>
    {(error || slow) && <><button type="button" className="sands-button primary" disabled={reloading} onClick={() => { setReloading(true); void reloadApplication(); }}>{reloading ? "正在重新加载…" : "重新加载"}</button>
      <small>已保存的筹码和记录会保留</small></>}
    {error && <details><summary>错误详情</summary><pre>{error.message}</pre></details>}
  </div>;
}

class LoadBoundary extends Component<{ title: string; children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }
  render() {
    return this.state.error ? <LoadStatus title={this.props.title} error={this.state.error} /> : this.props.children;
  }
}

export function GameLoader({ title, children }: { title: string; children: ReactNode }) {
  return <LoadBoundary title={title}><Suspense fallback={<LoadStatus title={title} />}>{children}</Suspense></LoadBoundary>;
}
