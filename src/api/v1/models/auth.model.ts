import type { User } from "../../../db/schema";

export interface AuthResult {
    token: string;
    user: Omit<User, "passwordHash">;
}
