import { relations } from "drizzle-orm";
import { campuses, organizations } from "./organizations.js";
import { organizationMembers, people, users } from "./people.js";
import {
  planAnnouncements,
  planRoleAssignments,
  planSongAssignments,
  planSongs,
  planSpeakers,
  plans,
  serviceOccurrences,
  services,
  servingRoles,
  songs,
} from "./scheduling.js";
import { teamMembers, teams } from "./teams.js";

export const organizationsRelations = relations(organizations, ({ many }) => ({
  campuses: many(campuses),
  members: many(organizationMembers),
  people: many(people),
  teams: many(teams),
  services: many(services),
  songs: many(songs),
  servingRoles: many(servingRoles),
}));

export const campusesRelations = relations(campuses, ({ one }) => ({
  organization: one(organizations, {
    fields: [campuses.organizationId],
    references: [organizations.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  organizationMembers: many(organizationMembers),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
}));

export const peopleRelations = relations(people, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [people.organizationId],
    references: [organizations.id],
  }),
  user: one(users, { fields: [people.userId], references: [users.id] }),
  planSpeakerAssignments: many(planSpeakers),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [teams.organizationId],
    references: [organizations.id],
  }),
  campus: one(campuses, { fields: [teams.campusId], references: [campuses.id] }),
  members: many(teamMembers),
  services: many(services),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
  organization: one(organizations, {
    fields: [teamMembers.organizationId],
    references: [organizations.id],
  }),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [services.organizationId],
    references: [organizations.id],
  }),
  team: one(teams, { fields: [services.teamId], references: [teams.id] }),
  occurrences: many(serviceOccurrences),
}));

export const serviceOccurrencesRelations = relations(serviceOccurrences, ({ one }) => ({
  service: one(services, { fields: [serviceOccurrences.serviceId], references: [services.id] }),
  plan: one(plans, {
    fields: [serviceOccurrences.id],
    references: [plans.serviceOccurrenceId],
  }),
}));

export const plansRelations = relations(plans, ({ one, many }) => ({
  serviceOccurrence: one(serviceOccurrences, {
    fields: [plans.serviceOccurrenceId],
    references: [serviceOccurrences.id],
  }),
  team: one(teams, { fields: [plans.teamId], references: [teams.id] }),
  speakers: many(planSpeakers),
  songs: many(planSongs),
  announcements: many(planAnnouncements),
  roleAssignments: many(planRoleAssignments),
}));

export const planSpeakersRelations = relations(planSpeakers, ({ one }) => ({
  plan: one(plans, { fields: [planSpeakers.planId], references: [plans.id] }),
  person: one(people, { fields: [planSpeakers.personId], references: [people.id] }),
}));

export const songsRelations = relations(songs, ({ one, many }) => ({
  organization: one(organizations, { fields: [songs.organizationId], references: [organizations.id] }),
  planSongs: many(planSongs),
}));

export const planSongsRelations = relations(planSongs, ({ one, many }) => ({
  plan: one(plans, { fields: [planSongs.planId], references: [plans.id] }),
  song: one(songs, { fields: [planSongs.songId], references: [songs.id] }),
  assignments: many(planSongAssignments),
}));

export const planSongAssignmentsRelations = relations(planSongAssignments, ({ one }) => ({
  planSong: one(planSongs, { fields: [planSongAssignments.planSongId], references: [planSongs.id] }),
  person: one(people, { fields: [planSongAssignments.personId], references: [people.id] }),
}));

export const planAnnouncementsRelations = relations(planAnnouncements, ({ one }) => ({
  plan: one(plans, { fields: [planAnnouncements.planId], references: [plans.id] }),
  assignedPerson: one(people, {
    fields: [planAnnouncements.assignedPersonId],
    references: [people.id],
  }),
}));

export const servingRolesRelations = relations(servingRoles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [servingRoles.organizationId],
    references: [organizations.id],
  }),
  team: one(teams, { fields: [servingRoles.teamId], references: [teams.id] }),
  assignments: many(planRoleAssignments),
}));

export const planRoleAssignmentsRelations = relations(planRoleAssignments, ({ one }) => ({
  plan: one(plans, { fields: [planRoleAssignments.planId], references: [plans.id] }),
  servingRole: one(servingRoles, {
    fields: [planRoleAssignments.servingRoleId],
    references: [servingRoles.id],
  }),
  person: one(people, { fields: [planRoleAssignments.personId], references: [people.id] }),
}));
