import type {
  GraphQLQuery,
  QueryResponse,
  QueryVariables,
  RecursiveMaybeFields,
} from '@polycanvas/graphql';
import type { GraphQLError } from 'graphql';
import { useMemo } from 'react';
import type { Key } from 'swr';
import { useSWRConfig } from 'swr';
import type {
  SWRMutationConfiguration,
  SWRMutationResponse,
} from 'swr/mutation';
import useSWRMutation from 'swr/mutation';

/**
 * A useSWRMutation wrapper for sending graphql mutations
 */
export function useMutation<Mutation extends GraphQLQuery, K extends Key = Key>(
  _options: { mutation: Mutation },
  _config?: Omit<
    SWRMutationConfiguration<
      QueryResponse<Mutation>,
      GraphQLError,
      K,
      QueryVariables<Mutation>
    >,
    'fetcher'
  >
): SWRMutationResponse<
  QueryResponse<Mutation>,
  GraphQLError,
  K,
  QueryVariables<Mutation>
>;
export function useMutation(options: { mutation: GraphQLQuery }, config?: any) {
  return useSWRMutation(
    () => ['cloud', options.mutation.id],
    () => {
      throw new Error('GraphQL service is not available');
    },
    config
  );
}

// use this to revalidate all queries that match the filter
export const useMutateQueryResource = () => {
  const { mutate } = useSWRConfig();
  const revalidateResource = useMemo(
    () =>
      <Q extends GraphQLQuery>(
        query: Q,
        varsFilter: (
          vars: RecursiveMaybeFields<QueryVariables<Q>>
        ) => boolean = _vars => true
      ) => {
        return mutate(key => {
          const res =
            Array.isArray(key) &&
            key[0] === 'cloud' &&
            key[1] === query.id &&
            varsFilter(key[2]);
          if (res) {
            console.debug('revalidate resource', key);
          }
          return res;
        });
      },
    [mutate]
  );

  return revalidateResource;
};
