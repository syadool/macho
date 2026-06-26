import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;

  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "MACHO GPT Actions API",
      version: "1.0.0",
      description: "Read-only access to a MACHO user's profile, workouts, stats, and exercise master data.",
    },
    servers: [{ url: origin }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "MACHO API Key",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
        Period: {
          type: "object",
          properties: {
            from: { type: "string", format: "date" },
            to: { type: "string", format: "date" },
            days: { type: "integer" },
          },
        },
        MuscleGroupRef: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            name_en: { type: "string" },
          },
        },
        MuscleSubGroupRef: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
          },
        },
        EquipmentRef: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
          },
        },
        MasterDataResponse: {
          type: "object",
          properties: {
            muscle_groups: {
              type: "array",
              items: {
                allOf: [
                  { $ref: "#/components/schemas/MuscleGroupRef" },
                  {
                    type: "object",
                    properties: {
                      sub_groups: {
                        type: "array",
                        items: { $ref: "#/components/schemas/MuscleSubGroupRef" },
                      },
                    },
                  },
                ],
              },
            },
            equipment: {
              type: "array",
              items: { $ref: "#/components/schemas/EquipmentRef" },
            },
          },
        },
        WorkoutSet: {
          type: "object",
          properties: {
            set_number: { type: "integer" },
            weight_kg: { type: "number" },
            reps: { type: "integer" },
            volume_kg: { type: "number" },
          },
        },
        WorkoutExercise: {
          type: "object",
          properties: {
            id: { type: "string" },
            exercise_name: { type: "string" },
            exercise_type: { type: "string", enum: ["strength", "cardio"] },
            muscle_group: {
              anyOf: [{ $ref: "#/components/schemas/MuscleGroupRef" }, { type: "null" }],
            },
            muscle_sub_groups: {
              type: "array",
              items: { $ref: "#/components/schemas/MuscleSubGroupRef" },
            },
            equipment: {
              anyOf: [{ $ref: "#/components/schemas/EquipmentRef" }, { type: "null" }],
            },
            sets: {
              type: "array",
              items: { $ref: "#/components/schemas/WorkoutSet" },
              description: "Strength training sets. Present for strength exercises.",
            },
            duration_minutes: {
              type: ["number", "null"],
              description: "Cardio duration. Present for cardio exercises.",
            },
            distance_km: {
              type: ["number", "null"],
              description: "Cardio distance. Present for cardio exercises.",
            },
            calories: {
              type: ["number", "null"],
              description: "Cardio calories. Present for cardio exercises.",
            },
          },
        },
        Workout: {
          type: "object",
          properties: {
            id: { type: "string" },
            date: { type: "string", format: "date" },
            exercises: {
              type: "array",
              items: { $ref: "#/components/schemas/WorkoutExercise" },
            },
          },
        },
        WorkoutsResponse: {
          type: "object",
          properties: {
            period: { $ref: "#/components/schemas/Period" },
            limit: { type: "integer" },
            count: { type: "integer" },
            workouts: {
              type: "array",
              items: { $ref: "#/components/schemas/Workout" },
            },
          },
        },
        StatsResponse: {
          type: "object",
          properties: {
            period: { $ref: "#/components/schemas/Period" },
            summary: {
              type: "object",
              properties: {
                total_sessions: { type: "integer" },
                avg_sessions_per_week: { type: "number" },
                total_sets: { type: "integer" },
                total_exercises: { type: "integer" },
              },
            },
            volume_by_muscle_group: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  name_en: { type: "string" },
                  total_sets: { type: "integer" },
                  total_reps: { type: "integer" },
                  total_volume_kg: { type: "number" },
                },
              },
            },
            progression: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  exercise_name: { type: "string" },
                  data_points: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        date: { type: "string", format: "date" },
                        max_weight_kg: { type: "number" },
                        max_reps_at_max_weight: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
            cardio_summary: {
              type: "object",
              properties: {
                total_sessions: { type: "integer" },
                total_duration_minutes: { type: "number" },
                total_distance_km: { type: "number" },
                total_calories: { type: "number" },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/api/gpt/profile": {
        get: {
          operationId: "getProfile",
          summary: "Get the user's training profile.",
          responses: {
            "200": {
              description: "Training profile",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      training_goal: { type: ["string", "null"] },
                      experience_level: { type: ["string", "null"] },
                      weekly_frequency: { type: ["integer", "null"] },
                      onboarding_completed: { type: "boolean" },
                      focus_muscle_group_ids: { type: "array", items: { type: "string" } },
                      focus_muscle_groups: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            name: { type: "string" },
                            name_en: { type: "string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "401": { description: "Unauthorized", content: errorContent() },
            "404": { description: "Profile not found", content: errorContent() },
            "500": { description: "Internal Server Error", content: errorContent() },
          },
        },
      },
      "/api/gpt/workouts": {
        get: {
          operationId: "getWorkouts",
          summary: "Get recent workout records.",
          parameters: [
            {
              name: "days",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 365, default: 30 },
              description: "Number of past days to include.",
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 200, default: 50 },
              description: "Maximum number of workout sessions to return.",
            },
          ],
          responses: {
            "200": {
              description: "Workout records",
              content: jsonContent({ $ref: "#/components/schemas/WorkoutsResponse" }),
            },
            "400": { description: "Invalid query parameter", content: errorContent() },
            "401": { description: "Unauthorized", content: errorContent() },
            "500": { description: "Internal Server Error", content: errorContent() },
          },
        },
      },
      "/api/gpt/stats": {
        get: {
          operationId: "getWorkoutStats",
          summary: "Get aggregated workout statistics.",
          parameters: [
            {
              name: "days",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 365, default: 30 },
              description: "Number of past days to include.",
            },
          ],
          responses: {
            "200": {
              description: "Aggregated workout statistics",
              content: jsonContent({ $ref: "#/components/schemas/StatsResponse" }),
            },
            "400": { description: "Invalid query parameter", content: errorContent() },
            "401": { description: "Unauthorized", content: errorContent() },
            "500": { description: "Internal Server Error", content: errorContent() },
          },
        },
      },
      "/api/gpt/exercises": {
        get: {
          operationId: "getExerciseMasterData",
          summary: "Get muscle groups, sub groups, and equipment master data.",
          responses: {
            "200": {
              description: "Exercise master data",
              content: jsonContent({ $ref: "#/components/schemas/MasterDataResponse" }),
            },
            "401": { description: "Unauthorized", content: errorContent() },
            "500": { description: "Internal Server Error", content: errorContent() },
          },
        },
      },
    },
  });
}

function jsonContent(schema: Record<string, unknown>) {
  return {
    "application/json": {
      schema,
    },
  };
}

function errorContent() {
  return jsonContent({ $ref: "#/components/schemas/Error" });
}
