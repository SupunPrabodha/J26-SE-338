export default function Loading() {
  return <main className="route-loading" aria-busy="true" aria-label="Loading workspace page"><p className="eyebrow">Your workspace</p><h1>Opening page</h1><p role="status">Loading the next view. Access is checked on each page.</p><div className="route-skeleton" aria-hidden="true"><span /><span /><span /></div></main>;
}
