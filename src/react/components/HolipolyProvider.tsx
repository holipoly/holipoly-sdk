import React, { ReactNode } from "react";
import { HolipolyClient } from "../../core";

export interface HolipolyProviderProps {
  children: ReactNode;
  client: HolipolyClient;
}
export type HolipolyContextType = {
  client: HolipolyClient;
};

export const HolipolyContext = React.createContext<HolipolyClient | null>(null);

export function HolipolyProvider({ client, children }: HolipolyProviderProps) {
  const [context, setContext] = React.useState<HolipolyClient>(client);

  React.useEffect(() => {
    setContext(client);
  }, [client]);

  if (context) {
    return (
      <HolipolyContext.Provider value={context}>
        {children}
      </HolipolyContext.Provider>
    );
  }

  return null;
}
