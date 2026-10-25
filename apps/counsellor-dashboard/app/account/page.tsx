import AccountProfile from "../../components/account-profile";

export default async function Page({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const value = (await searchParams).workspace;
  return <AccountProfile workspace={value === "admin" || value === "research" ? value : "counsellor"} />;
}
