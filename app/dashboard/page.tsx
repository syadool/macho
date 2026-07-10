import { DashboardClient } from "./dashboard-client";
import { getAllWorkouts } from "@/lib/data";
import { requireOnboardedUser } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function DashboardPage(){await requireOnboardedUser();return <DashboardClient initialWorkouts={await getAllWorkouts()}/>;}
