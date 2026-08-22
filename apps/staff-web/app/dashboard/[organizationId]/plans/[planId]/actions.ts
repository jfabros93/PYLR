"use server";

import { revalidatePath } from "next/cache";
import {
  addAnnouncementSchema,
  addSongToPlanSchema,
  addSpeakerSchema,
  assignRoleSchema,
  assignSongPersonSchema,
  createPersonSchema,
  createSongSchema,
  updateAssignmentStatusSchema,
  updatePlanSchema,
} from "@pylr/schemas";
import { apiFetch } from "@/lib/api";

function revalidate(organizationId: string, planId: string) {
  revalidatePath(`/dashboard/${organizationId}/plans/${planId}`);
}

export async function updatePlanAction(organizationId: string, planId: string, formData: FormData) {
  const parsed = updatePlanSchema.safeParse({
    title: formData.get("title") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  await apiFetch(`/organizations/${organizationId}/plans/${planId}`, { method: "PATCH", body: JSON.stringify(parsed.data) });
  revalidate(organizationId, planId);
}

export async function publishPlanAction(organizationId: string, planId: string) {
  await apiFetch(`/organizations/${organizationId}/plans/${planId}/publish`, { method: "POST" });
  revalidate(organizationId, planId);
}

export async function addSpeakerAction(organizationId: string, planId: string, formData: FormData) {
  const parsed = addSpeakerSchema.safeParse({
    personId: formData.get("personId") || undefined,
    guestFirstName: formData.get("guestFirstName") || undefined,
    guestLastName: formData.get("guestLastName") || undefined,
    roleLabel: formData.get("roleLabel") || undefined,
    sermonTitle: formData.get("sermonTitle") || undefined,
    order: 0,
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  await apiFetch(`/organizations/${organizationId}/plans/${planId}/speakers`, {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });
  revalidate(organizationId, planId);
}

export async function removeSpeakerAction(organizationId: string, planId: string, speakerId: string) {
  await apiFetch(`/organizations/${organizationId}/plans/${planId}/speakers/${speakerId}`, { method: "DELETE" });
  revalidate(organizationId, planId);
}

export async function createSongAction(organizationId: string, formData: FormData) {
  const parsed = createSongSchema.safeParse({
    title: formData.get("title"),
    artist: formData.get("artist") || undefined,
    defaultKey: formData.get("defaultKey") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  await apiFetch(`/organizations/${organizationId}/songs`, { method: "POST", body: JSON.stringify(parsed.data) });
}

export async function addSongToPlanAction(organizationId: string, planId: string, formData: FormData) {
  const parsed = addSongToPlanSchema.safeParse({
    songId: formData.get("songId"),
    order: 0,
    key: formData.get("key") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  await apiFetch(`/organizations/${organizationId}/plans/${planId}/songs`, {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });
  revalidate(organizationId, planId);
}

export async function removeSongAction(organizationId: string, planId: string, planSongId: string) {
  await apiFetch(`/organizations/${organizationId}/plans/${planId}/songs/${planSongId}`, { method: "DELETE" });
  revalidate(organizationId, planId);
}

export async function assignSongPersonAction(
  organizationId: string,
  planId: string,
  planSongId: string,
  formData: FormData,
) {
  const parsed = assignSongPersonSchema.safeParse({
    personId: formData.get("personId"),
    instrumentOrRole: formData.get("instrumentOrRole"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  await apiFetch(`/organizations/${organizationId}/plans/${planId}/songs/${planSongId}/assignments`, {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });
  revalidate(organizationId, planId);
}

export async function addAnnouncementAction(organizationId: string, planId: string, formData: FormData) {
  const parsed = addAnnouncementSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
    assignedPersonId: formData.get("assignedPersonId") || undefined,
    order: 0,
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  await apiFetch(`/organizations/${organizationId}/plans/${planId}/announcements`, {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });
  revalidate(organizationId, planId);
}

export async function removeAnnouncementAction(organizationId: string, planId: string, announcementId: string) {
  await apiFetch(`/organizations/${organizationId}/plans/${planId}/announcements/${announcementId}`, { method: "DELETE" });
  revalidate(organizationId, planId);
}

export async function addRoleAssignmentAction(organizationId: string, planId: string, formData: FormData) {
  const parsed = assignRoleSchema.safeParse({
    servingRoleId: formData.get("servingRoleId"),
    personId: formData.get("personId") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  await apiFetch(`/organizations/${organizationId}/plans/${planId}/role-assignments`, {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });
  revalidate(organizationId, planId);
}

export async function updateAssignmentStatusAction(
  organizationId: string,
  planId: string,
  assignmentId: string,
  status: "confirmed" | "declined" | "invited",
) {
  const parsed = updateAssignmentStatusSchema.parse({ status });
  await apiFetch(`/organizations/${organizationId}/plans/${planId}/role-assignments/${assignmentId}`, {
    method: "PATCH",
    body: JSON.stringify(parsed),
  });
  revalidate(organizationId, planId);
}

export async function removeRoleAssignmentAction(organizationId: string, planId: string, assignmentId: string) {
  await apiFetch(`/organizations/${organizationId}/plans/${planId}/role-assignments/${assignmentId}`, { method: "DELETE" });
  revalidate(organizationId, planId);
}

export async function createPersonAction(organizationId: string, planId: string, formData: FormData) {
  const parsed = createPersonSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName") || undefined,
    email: formData.get("email") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  await apiFetch(`/organizations/${organizationId}/people`, { method: "POST", body: JSON.stringify(parsed.data) });
  revalidate(organizationId, planId);
}
