import AccountProfile from "../../components/account-profile";

export default async function Page({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const value = (await searchParams).workspace;
  const workspace = value === "admin" || value === "research" ? value : "counsellor";
  return <AccountProfile key={workspace} workspace={workspace} />;
}
