"use client";

import { z } from "zod";

// Business configuration schema
const BusinessHoursSchema = z.object({
  monday: z.tuple([z.string(), z.string()]).optional().default(["09:00", "18:00"]),
  tuesday: z.tuple([z.string(), z.string()]).optional().default(["09:00", "18:00"]),
  wednesday: z.tuple([z.string(), z.string()]).optional().default(["09:00", "18:00"]),
  thursday: z.tuple([z.string(), z.string()]).optional().default(["09:00", "18:00"]),
  friday: z.tuple([z.string(), z.string()]).optional().default(["09:00", "18:00"]),
  saturday: z.tuple([z.string(), z.string()]).optional().default(["10:00", "16:00"]),
  sunday: z.tuple([z.string(), z.string()]).optional().default(["10:00", "16:00"]),
});

const QualificationFieldSchema = z.string();

export type QualificationField = z.infer<typeof QualificationFieldSchema>;

export const BusinessConfigSchema = z.object({
  business_name: z.string().default("Waves Business"),
  timezone: z.string().default("Asia/Kolkata"),
  business_hours: BusinessHoursSchema,
  qualification_fields: z.array(QualificationFieldSchema).default([
    "service_needed",
    "budget",
    "timeline",
    "location",
  ]),
  notification_channels: z.array(z.string()).default(["sms", "email"]),
});

export type BusinessConfig = z.infer<typeof BusinessConfigSchema>;

export function isWithinBusinessHours(
  date: Date,
  config: BusinessConfig
): boolean {
  const dayMap: Record<string, keyof typeof config.business_hours> = {
    monday: "monday",
    tuesday: "tuesday",
    wednesday: "wednesday",
    thursday: "thursday",
    friday: "friday",
    saturday: "saturday",
    sunday: "sunday",
  };

  const dayName = dayMap[date.toLocaleString("en-US", { weekday: "long" }).toLowerCase()];

  if (!dayName) {
    return false;
  }

  const hours = config.business_hours[dayName];

  if (!hours || hours.length !== 2) {
    return false;
  }

  const [openStr, closeStr] = hours;
  const openHour = parseInt(openStr.split(":")[0]);
  const closeHour = parseInt(closeStr.split(":")[0]);

  // Simple hour-based check (ignores minutes for demo)
  const currentHour = date.getHours();

  return currentHour >= openHour && currentHour < closeHour;
}