import type {
  GraphQLQuery,
  QueryOptions,
  QueryResponse,
} from '@polycanvas/graphql';
import type { GraphQLError } from 'graphql';
import { useCallback, useMemo } from 'react';
import type { SWRConfiguration, SWRResponse } from 'swr';
import useSWR from 'swr';
import useSWRImmutable from 'swr/immutable';
import useSWRInfinite from 'swr/infinite';

export type UseQueryConfig<Query extends GraphQLQuery = GraphQLQuery> = Omit<
  SWRConfiguration<
    QueryResponse<Query>,
    GraphQLError,
    (options: QueryOptions<Query>) => Promise<QueryResponse<Query>>
  >,
  'fetcher'
>;

/**
 * A `useSWR` wrapper for sending graphql queries
 */
type useQueryFn = <Query extends GraphQLQuery>(
  options?: QueryOptions<Query>,
  config?: UseQueryConfig<Query>
) => SWRResponse<
  QueryResponse<Query>,
  GraphQLError,
  {
    suspense: true;
  }
>;

const createUseQuery =
  (immutable: boolean): useQueryFn =>
  (options, config) => {
    const configWithSuspense: SWRConfiguration = useMemo(
      () => ({
        suspense: true,
        ...config,
      }),
      [config]
    );

    const useSWRFn = immutable ? useSWRImmutable : useSWR;
    return useSWRFn(
      options ? () => ['cloud', options.query.id, options.variables] : null,
      options
        ? () => {
            throw new Error('GraphQL service is not available');
          }
        : null,
      configWithSuspense
    );
  };

export const useQuery = createUseQuery(false);
export const useQueryImmutable = createUseQuery(true);

export function useQueryInfinite<Query extends GraphQLQuery>(
  options: Omit<QueryOptions<Query>, 'variables'> & {
    getVariables: (
      pageIndex: number,
      previousPageData: QueryResponse<Query>
    ) => QueryOptions<Query>['variables'];
  },
  config?: Omit<
    SWRConfiguration<
      QueryResponse<Query>,
      GraphQLError | GraphQLError[],
      (options: QueryOptions<Query>) => Promise<QueryResponse<Query>>
    >,
    'fetcher'
  >
) {
  const configWithSuspense: SWRConfiguration = useMemo(
    () => ({
      suspense: true,
      ...config,
    }),
    [config]
  );

  const { data, setSize, size, error } = useSWRInfinite<
    QueryResponse<Query>,
    GraphQLError | GraphQLError[]
  >(
    (pageIndex: number, previousPageData: QueryResponse<Query>) => [
      'cloud',
      options.query.id,
      options.getVariables(pageIndex, previousPageData),
    ],
    async () => {
      throw new Error('GraphQL service is not available');
    },
    configWithSuspense
  );

  const loadingMore = size > 0 && data && !data[size - 1];

  const loadMore = useCallback(() => {
    if (loadingMore) {
      return;
    }
    setSize(size => size + 1).catch(err => {
      console.error(err);
    });
  }, [loadingMore, setSize]);
  return {
    data,
    error,
    loadingMore,
    loadMore,
  };
}
