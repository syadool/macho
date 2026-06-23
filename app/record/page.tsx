import { BottomNav, PageTitle } from "@/components/ui";
import { PhoneShell } from "@/components/phone-shell";
import { getMasterData } from "@/lib/data";
import { RecordForm } from "./record-form";

export const dynamic = "force-dynamic";

export default async function RecordPage() {
  const { muscleGroups, equipment } = await getMasterData();

  return (
    <PhoneShell nav={<BottomNav active="record" />}>
      <section className="pt-2">
        <PageTitle>
          新規<span className="text-macho-lime">記録</span>
        </PageTitle>
      </section>
      <RecordForm muscleGroups={muscleGroups} equipment={equipment} />
    </PhoneShell>
  );
}
