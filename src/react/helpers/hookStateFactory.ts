import { useContext } from "react";
import { DocumentNode, QueryResult, useQuery } from "@apollo/client";
import { HolipolyContext } from "../components/HolipolyProvider";

const CreateHolipolyStateHook = <TData, TVariables>(
  query: DocumentNode
): QueryResult<TData, TVariables> => {
  const holipolyClient = useContext(HolipolyContext);

  if (!holipolyClient) {
    throw new Error(
      "Could not find holipoly's apollo client in the context. Did you forget to wrap the root component in a <HolipolyProvider>?"
    );
  }

  return useQuery<TData, TVariables>(query, {
    client: holipolyClient._internal.apolloClient,
    fetchPolicy: "cache-only",
  });
};

export const hookStateFactory = <TData, TVariables>(
  query: DocumentNode
): QueryResult<TData, TVariables> =>
  CreateHolipolyStateHook<TData, TVariables>(query);
