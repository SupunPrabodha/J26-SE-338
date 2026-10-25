import { notFound } from "next/navigation";
import AdminConsole, { type AdminSection } from "../../../components/admin-console";

const sections: AdminSection[] = ["overview", "staff", "assignments", "operations", "retention"];
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.includes(section as AdminSection)) notFound();
  return <AdminConsole key={section} section={section as AdminSection} />;
}
