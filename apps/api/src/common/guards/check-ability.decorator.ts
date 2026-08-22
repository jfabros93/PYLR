import { SetMetadata } from "@nestjs/common";
import type { AppAbility } from "@pylr/auth";

export const CHECK_ABILITY_KEY = "check_ability";
export type AbilityCheck = (ability: AppAbility) => boolean;

/** Declares the CASL check AbilityGuard must pass for this route, e.g. `@CheckAbility((a) => a.can("invite", "OrganizationMember"))`. */
export const CheckAbility = (check: AbilityCheck) => SetMetadata(CHECK_ABILITY_KEY, check);
