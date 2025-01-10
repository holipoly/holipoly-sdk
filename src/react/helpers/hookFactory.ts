import { useContext } from "react";
import { HolipolyClient } from "../../core/types";
import { HolipolyContext } from "../components/HolipolyProvider";

const CreateHolipolyHook = <T extends keyof HolipolyClient>(
  key: T
): HolipolyClient[T] => {
  const holipolyClient = useContext(HolipolyContext);

  if (!holipolyClient) {
    throw new Error(
      "Could not find holipoly's apollo client in the context. Did you forget to wrap the root component in a <HolipolyProvider>?"
    );
  }

  const getHookData = (): HolipolyClient[T] => {
    return holipolyClient[key];
  };

  return getHookData();
};

export const hookFactory = <T extends keyof HolipolyClient>(
  query: T
) => (): HolipolyClient[T] => CreateHolipolyHook(query);
