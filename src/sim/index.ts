export * from './types';
export * from './match';
import teamsJson from '../data/teams.json';
import type { TeamDef } from './types';

export const PLACEHOLDER_TEAMS = teamsJson.teams as [TeamDef, TeamDef];
