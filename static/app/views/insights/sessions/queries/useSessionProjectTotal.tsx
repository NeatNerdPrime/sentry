import type {SessionApiResponse} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import {getSessionsInterval} from 'sentry/utils/sessions';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export default function useSessionProjectTotal() {
  const location = useLocation();
  const organization = useOrganization();
  const {
    selection: {datetime},
  } = usePageFilters();

  const locationQuery = {
    ...location,
    query: {
      ...location.query,
      query: undefined,
      width: undefined,
      cursor: undefined,
    },
  };

  const {
    data: projSessionData,
    isPending,
    isError,
  } = useApiQuery<SessionApiResponse>(
    [
      `/organizations/${organization.slug}/sessions/`,
      {
        query: {
          ...locationQuery.query,
          interval: getSessionsInterval(datetime),
          field: ['sum(session)'],
          groupBy: ['project'],
        },
      },
    ],
    {staleTime: 0}
  );

  if (isPending || isError || !projSessionData) {
    return 0;
  }

  return projSessionData.groups.length
    ? (projSessionData.groups[0]!.totals['sum(session)'] ?? 0)
    : 0;
}
