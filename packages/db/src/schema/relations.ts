import { relations } from "drizzle-orm";
import { campuses, organizations } from "./organizations.js";
import { organizationMembers, people, users } from "./people.js";
import { teamMembers, teams } from "./teams.js";

export const organizationsRelations = relations(organizations, ({ many }) => ({
  campuses: many(campuses),
  members: many(organizationMembers),
  people: many(people),
  teams: many(teams),
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

export const peopleRelations = relations(people, ({ one }) => ({
  organization: one(organizations, {
    fields: [people.organizationId],
    references: [organizations.id],
  }),
  user: one(users, { fields: [people.userId], references: [users.id] }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [teams.organizationId],
    references: [organizations.id],
  }),
  campus: one(campuses, { fields: [teams.campusId], references: [campuses.id] }),
  members: many(teamMembers),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
  organization: one(organizations, {
    fields: [teamMembers.organizationId],
    references: [organizations.id],
  }),
}));
