import { workspace, type Workspace } from "./workspace";
export function isAdministrator(actor: Workspace = workspace()) {
 const email=process.env.ADMIN_EMAIL?.trim().toLowerCase();
 return !!(email && actor.userId && actor.emailConfirmed && actor.email?.toLowerCase()===email);
}
