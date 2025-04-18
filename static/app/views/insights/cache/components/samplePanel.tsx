import {Fragment} from 'react';
import keyBy from 'lodash/keyBy';

import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {DrawerHeader} from 'sentry/components/globalDrawer/components';
import {SpanSearchQueryBuilder} from 'sentry/components/performance/spanSearchQueryBuilder';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {DurationUnit, RateUnit, SizeUnit} from 'sentry/utils/discover/fields';
import {PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {CacheHitMissChart} from 'sentry/views/insights/cache/components/charts/hitMissChart';
import {TransactionDurationChart} from 'sentry/views/insights/cache/components/charts/transactionDurationChart';
import {SpanSamplesTable} from 'sentry/views/insights/cache/components/tables/spanSamplesTable';
import {Referrer} from 'sentry/views/insights/cache/referrers';
import {BASE_FILTERS} from 'sentry/views/insights/cache/settings';
import {MetricReadout} from 'sentry/views/insights/common/components/metricReadout';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ReadoutRibbon} from 'sentry/views/insights/common/components/ribbon';
import {SampleDrawerBody} from 'sentry/views/insights/common/components/sampleDrawerBody';
import {SampleDrawerHeaderTransaction} from 'sentry/views/insights/common/components/sampleDrawerHeaderTransaction';
import {getTimeSpentExplanation} from 'sentry/views/insights/common/components/tableCells/timeSpentCell';
import {
  useMetrics,
  useSpanMetrics,
  useSpansIndexed,
} from 'sentry/views/insights/common/queries/useDiscover';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {useTransactions} from 'sentry/views/insights/common/queries/useTransactions';
import {findSampleFromDataPoint} from 'sentry/views/insights/common/utils/findDataPoint';
import {
  DataTitles,
  getThroughputTitle,
} from 'sentry/views/insights/common/views/spans/types';
import {useDebouncedState} from 'sentry/views/insights/http/utils/useDebouncedState';
import {
  MetricsFields,
  type MetricsQueryFilters,
  ModuleName,
  SpanFunction,
  SpanIndexedField,
  type SpanIndexedQueryFilters,
  type SpanIndexedResponse,
  SpanMetricsField,
  type SpanMetricsQueryFilters,
} from 'sentry/views/insights/types';

// This is similar to http sample table, its difficult to use the generic span samples sidebar as we require a bunch of custom things.
export function CacheSamplePanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const query = useLocationQuery({
    fields: {
      project: decodeScalar,
      transaction: decodeScalar,
      statusClass: decodeScalar,
      spanSearchQuery: decodeScalar,
    },
  });

  const [highlightedSpanId, setHighlightedSpanId] = useDebouncedState<string | undefined>(
    undefined,
    [],
    10
  );

  // @ts-expect-error TS(7006): Parameter 'newStatusClass' implicitly has an 'any'... Remove this comment to see the full error message
  const handleStatusClassChange = newStatusClass => {
    trackAnalytics('performance_views.sample_spans.filter_updated', {
      filter: 'status',
      new_state: newStatusClass.value,
      organization,
      source: ModuleName.CACHE,
    });
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        statusClass: newStatusClass.value,
      },
    });
  };

  const filters: SpanMetricsQueryFilters = {
    ...BASE_FILTERS,
    transaction: query.transaction,
    'project.id': query.project,
  };

  const {data: cacheHitRateData, isPending: isCacheHitRateLoading} = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(filters satisfies SpanMetricsQueryFilters),
      yAxis: [`${SpanFunction.CACHE_MISS_RATE}()`],
      transformAliasToInputFormat: true,
    },
    Referrer.SAMPLES_CACHE_HIT_MISS_CHART
  );

  const {data: cacheTransactionMetrics, isFetching: areCacheTransactionMetricsFetching} =
    useSpanMetrics(
      {
        search: MutableSearch.fromQueryObject(filters),
        fields: [
          `${SpanFunction.EPM}()`,
          `${SpanFunction.CACHE_MISS_RATE}()`,
          `${SpanFunction.TIME_SPENT_PERCENTAGE}()`,
          `sum(${SpanMetricsField.SPAN_SELF_TIME})`,
          `avg(${SpanMetricsField.CACHE_ITEM_SIZE})`,
        ],
      },
      Referrer.SAMPLES_CACHE_METRICS_RIBBON
    );

  const {data: transactionDurationData, isPending: isTransactionDurationLoading} =
    useMetrics(
      {
        search: MutableSearch.fromQueryObject({
          transaction: query.transaction,
        } satisfies MetricsQueryFilters),
        fields: [`avg(${MetricsFields.TRANSACTION_DURATION})`],
      },
      Referrer.SAMPLES_CACHE_TRANSACTION_DURATION
    );

  const sampleFilters: SpanIndexedQueryFilters = {
    ...BASE_FILTERS,
    transaction: query.transaction,
    project_id: query.project,
  };

  const useIndexedCacheSpans = (
    isCacheHit: SpanIndexedResponse['cache.hit'],
    limit: number
  ) =>
    useSpansIndexed(
      {
        search: MutableSearch.fromQueryObject({
          ...sampleFilters,
          ...new MutableSearch(query.spanSearchQuery).filters,
          'cache.hit': isCacheHit,
        }),
        fields: [
          SpanIndexedField.PROJECT,
          SpanIndexedField.TRACE,
          SpanIndexedField.TRANSACTION_ID,
          SpanIndexedField.SPAN_ID,
          SpanIndexedField.TIMESTAMP,
          SpanIndexedField.SPAN_DESCRIPTION,
          SpanIndexedField.CACHE_HIT,
          SpanIndexedField.SPAN_OP,
          SpanIndexedField.CACHE_ITEM_SIZE,
        ],
        sorts: [SPAN_SAMPLES_SORT],
        limit,
      },
      Referrer.SAMPLES_CACHE_SPAN_SAMPLES
    );

  // display half hits and half misses by default
  let cacheHitSamplesLimit = SPAN_SAMPLE_LIMIT / 2;
  let cacheMissSamplesLimit = SPAN_SAMPLE_LIMIT / 2;

  if (query.statusClass === 'hit') {
    cacheHitSamplesLimit = SPAN_SAMPLE_LIMIT;
    cacheMissSamplesLimit = -1;
  } else if (query.statusClass === 'miss') {
    cacheHitSamplesLimit = -1;
    cacheMissSamplesLimit = SPAN_SAMPLE_LIMIT;
  }

  const {
    data: cacheHitSamples,
    isFetching: isCacheHitsFetching,
    refetch: refetchCacheHits,
  } = useIndexedCacheSpans('true', cacheHitSamplesLimit);

  const {
    data: cacheMissSamples,
    isFetching: isCacheMissesFetching,
    refetch: refetchCacheMisses,
  } = useIndexedCacheSpans('false', cacheMissSamplesLimit);

  const cacheSamples = [...(cacheHitSamples || []), ...(cacheMissSamples || [])];

  const {
    data: transactionData,
    error: transactionError,
    isFetching: isFetchingTransactions,
  } = useTransactions(
    cacheSamples?.map(span => span['transaction.id']) || [],
    Referrer.SAMPLES_CACHE_SPAN_SAMPLES
  );

  const transactionDurationsMap = keyBy(transactionData, 'id');

  const spansWithDuration =
    cacheSamples?.map(span => ({
      ...span,
      'transaction.duration':
        transactionDurationsMap[span['transaction.id']]?.['transaction.duration']!,
    })) || [];

  const {projects} = useProjects();
  const project = projects.find(p => query.project === p.id);

  const handleSearch = (newSpanSearchQuery: string) => {
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        spanSearchQuery: newSpanSearchQuery,
      },
    });
  };

  const handleRefetch = () => {
    refetchCacheHits();
    refetchCacheMisses();
  };

  return (
    <PageAlertProvider>
      <DrawerHeader>
        <SampleDrawerHeaderTransaction
          project={project}
          transaction={query.transaction}
        />
      </DrawerHeader>

      <SampleDrawerBody>
        <ModuleLayout.Layout>
          <ModuleLayout.Full>
            <ReadoutRibbon>
              <MetricReadout
                title={DataTitles[`avg(${SpanMetricsField.CACHE_ITEM_SIZE})`]}
                value={
                  cacheTransactionMetrics?.[0]?.[
                    `avg(${SpanMetricsField.CACHE_ITEM_SIZE})`
                  ]
                }
                unit={SizeUnit.BYTE}
                isLoading={areCacheTransactionMetricsFetching}
              />
              <MetricReadout
                title={getThroughputTitle('cache')}
                value={cacheTransactionMetrics?.[0]?.[`${SpanFunction.EPM}()`]}
                unit={RateUnit.PER_MINUTE}
                isLoading={areCacheTransactionMetricsFetching}
              />

              <MetricReadout
                title={DataTitles[`avg(${MetricsFields.TRANSACTION_DURATION})`]}
                value={
                  transactionDurationData?.[0]?.[
                    `avg(${MetricsFields.TRANSACTION_DURATION})`
                  ]
                }
                unit={DurationUnit.MILLISECOND}
                isLoading={isTransactionDurationLoading}
              />

              <MetricReadout
                title={DataTitles[`${SpanFunction.CACHE_MISS_RATE}()`]}
                value={
                  cacheTransactionMetrics?.[0]?.[`${SpanFunction.CACHE_MISS_RATE}()`]
                }
                unit="percentage"
                isLoading={areCacheTransactionMetricsFetching}
              />

              <MetricReadout
                title={DataTitles.timeSpent}
                value={cacheTransactionMetrics?.[0]?.['sum(span.self_time)']}
                unit={DurationUnit.MILLISECOND}
                tooltip={getTimeSpentExplanation(
                  cacheTransactionMetrics?.[0]?.['time_spent_percentage()']!
                )}
                isLoading={areCacheTransactionMetricsFetching}
              />
            </ReadoutRibbon>
          </ModuleLayout.Full>
          <ModuleLayout.Full>
            <CompactSelect
              value={query.statusClass}
              options={CACHE_STATUS_OPTIONS}
              onChange={handleStatusClassChange}
              triggerProps={{
                prefix: t('Status'),
              }}
            />
          </ModuleLayout.Full>
          <ModuleLayout.Half>
            <CacheHitMissChart
              isLoading={isCacheHitRateLoading}
              series={cacheHitRateData[`cache_miss_rate()`]}
            />
          </ModuleLayout.Half>
          <ModuleLayout.Half>
            <TransactionDurationChart
              samples={spansWithDuration}
              averageTransactionDuration={
                transactionDurationData?.[0]?.[
                  `avg(${MetricsFields.TRANSACTION_DURATION})`
                ]!
              }
              highlightedSpanId={highlightedSpanId}
              onHighlight={highlights => {
                const firstHighlight = highlights[0];

                if (!firstHighlight || !firstHighlight.dataPoint) {
                  setHighlightedSpanId(undefined);
                  return;
                }

                const sample = findSampleFromDataPoint<(typeof spansWithDuration)[0]>(
                  firstHighlight.dataPoint,
                  spansWithDuration,
                  'transaction.duration'
                );
                setHighlightedSpanId(sample?.span_id);
              }}
            />
          </ModuleLayout.Half>

          <ModuleLayout.Full>
            <SpanSearchQueryBuilder
              searchSource={`${ModuleName.CACHE}-sample-panel`}
              initialQuery={query.spanSearchQuery}
              onSearch={handleSearch}
              placeholder={t('Search for span attributes')}
              projects={selection.projects}
            />
          </ModuleLayout.Full>

          <Fragment>
            <ModuleLayout.Full>
              <SpanSamplesTable
                data={spansWithDuration ?? []}
                meta={{
                  fields: {
                    'transaction.duration': 'duration',
                    [SpanIndexedField.CACHE_ITEM_SIZE]: 'size',
                  },
                  units: {[SpanIndexedField.CACHE_ITEM_SIZE]: 'byte'},
                }}
                isLoading={
                  isCacheHitsFetching || isCacheMissesFetching || isFetchingTransactions
                }
                highlightedSpanId={highlightedSpanId}
                onSampleMouseOver={sample => setHighlightedSpanId(sample.span_id)}
                onSampleMouseOut={() => setHighlightedSpanId(undefined)}
                error={transactionError}
              />
            </ModuleLayout.Full>
          </Fragment>

          <Fragment>
            <ModuleLayout.Full>
              <Button
                onClick={() => {
                  trackAnalytics(
                    'performance_views.sample_spans.try_different_samples_clicked',
                    {organization, source: ModuleName.CACHE}
                  );
                  handleRefetch();
                }}
              >
                {t('Try Different Samples')}
              </Button>
            </ModuleLayout.Full>
          </Fragment>
        </ModuleLayout.Layout>
      </SampleDrawerBody>
    </PageAlertProvider>
  );
}

const SPAN_SAMPLE_LIMIT = 10;

const SPAN_SAMPLES_SORT = {
  field: 'span_id',
  kind: 'desc' as const,
};

const CACHE_STATUS_OPTIONS = [
  {
    value: '',
    label: t('All'),
  },
  {
    value: 'hit',
    label: t('Hit'),
  },
  {
    value: 'miss',
    label: t('Miss'),
  },
];
