import Dashboard from "../components/counsellor-workspace";

export default async function Page({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const state = (await searchParams).state === "COMPLETED" ? "COMPLETED" : "";
  return <Dashboard key={state} initialState={state} />;
}
