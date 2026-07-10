import { HistoryClient } from "./history-client";
import { getMasterData, getWorkouts } from "@/lib/data";
import { requireOnboardedUser } from "@/lib/supabase/server";
export const dynamic="force-dynamic";
export default async function HistoryPage(){await requireOnboardedUser();const [{muscleGroups},workouts]=await Promise.all([getMasterData(),getWorkouts(50)]);return <HistoryClient initialWorkouts={workouts} muscleGroups={muscleGroups}/>}
