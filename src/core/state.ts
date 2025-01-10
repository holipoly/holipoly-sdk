import { USER } from "../apollo/queries";
import { UserQuery } from "../apollo/types";
import { HolipolyClientInternals } from "./types";

export type State = UserQuery | null;

export const getState = (
  client: HolipolyClientInternals["apolloClient"]
): State =>
  client.readQuery<UserQuery>({
    query: USER,
  });
