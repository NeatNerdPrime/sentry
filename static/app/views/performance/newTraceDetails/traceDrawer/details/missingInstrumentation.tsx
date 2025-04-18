import {useTheme} from '@emotion/react';

import ExternalLink from 'sentry/components/links/externalLink';
import {IconSpan} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import getDuration from 'sentry/utils/duration/getDuration';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import useProjects from 'sentry/utils/useProjects';
import {getCustomInstrumentationLink} from 'sentry/views/performance/newTraceDetails/traceConfigurations';
import {ProfilePreview} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/profiling/profilePreview';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {MissingInstrumentationNode} from 'sentry/views/performance/newTraceDetails/traceModels/missingInstrumentationNode';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {makeTraceNodeBarColor} from 'sentry/views/performance/newTraceDetails/traceRow/traceBar';
import {getTraceTabTitle} from 'sentry/views/performance/newTraceDetails/traceState/traceTabs';
import {useHasTraceNewUi} from 'sentry/views/performance/newTraceDetails/useHasTraceNewUi';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import {type SectionCardKeyValueList, TraceDrawerComponents} from './styles';
import {getProfileMeta} from './utils';

export function MissingInstrumentationNodeDetails(
  props: TraceTreeNodeDetailsProps<MissingInstrumentationNode>
) {
  const {projects} = useProjects();
  const hasTraceNewUi = useHasTraceNewUi();

  if (!hasTraceNewUi) {
    return <LegacyMissingInstrumentationNodeDetails {...props} />;
  }

  const {node, organization, onTabScrollToNode} = props;
  const event = node.previous.event ?? node.next.event ?? null;
  const project = projects.find(proj => proj.slug === event?.projectSlug);
  const profileMeta = getProfileMeta(event) || '';
  const profileId =
    typeof profileMeta === 'string' ? profileMeta : profileMeta.profiler_id;

  return (
    <TraceDrawerComponents.DetailContainer>
      <TraceDrawerComponents.HeaderContainer>
        <TraceDrawerComponents.Title>
          <TraceDrawerComponents.LegacyTitleText>
            <TraceDrawerComponents.TitleText>
              {t('No Instrumentation')}
            </TraceDrawerComponents.TitleText>
            <TraceDrawerComponents.SubtitleWithCopyButton
              clipboardText=""
              subTitle={t('How Awkward')}
            />
          </TraceDrawerComponents.LegacyTitleText>
        </TraceDrawerComponents.Title>
        <TraceDrawerComponents.NodeActions
          node={node}
          organization={organization}
          onTabScrollToNode={onTabScrollToNode}
        />
      </TraceDrawerComponents.HeaderContainer>
      <TraceDrawerComponents.BodyContainer hasNewTraceUi={hasTraceNewUi}>
        <p>
          {tct(
            'It looks like there’s more than 100ms unaccounted for. This might be a missing service or just idle time. If you know there’s something going on, you can [customInstrumentationLink: add more spans using custom instrumentation].',
            {
              customInstrumentationLink: (
                <ExternalLink href={getCustomInstrumentationLink(project)} />
              ),
            }
          )}
        </p>
        {event?.projectSlug ? (
          <ProfilesProvider
            orgSlug={organization.slug}
            projectSlug={event?.projectSlug ?? ''}
            profileMeta={profileMeta}
          >
            <ProfileContext.Consumer>
              {profiles => (
                <ProfileGroupProvider
                  type="flamechart"
                  input={profiles?.type === 'resolved' ? profiles.data : null}
                  traceID={profileId || ''}
                >
                  <ProfilePreview event={event} node={node} />
                </ProfileGroupProvider>
              )}
            </ProfileContext.Consumer>
          </ProfilesProvider>
        ) : null}
        <p>
          {t("If you'd prefer, you can also turn the feature off in the settings above.")}
        </p>
      </TraceDrawerComponents.BodyContainer>
    </TraceDrawerComponents.DetailContainer>
  );
}

function LegacyMissingInstrumentationNodeDetails({
  node,
  onParentClick,
  onTabScrollToNode,
  organization,
}: TraceTreeNodeDetailsProps<MissingInstrumentationNode>) {
  const theme = useTheme();
  const {projects} = useProjects();

  const parentTransaction = TraceTree.ParentTransaction(node);
  const event = node.previous.event ?? node.next.event ?? null;
  const project = projects.find(proj => proj.slug === event?.projectSlug);
  const profileId = event?.contexts?.profile?.profile_id ?? null;

  const items: SectionCardKeyValueList = [
    {
      key: 'duration',
      subject: t('Duration'),
      value: getDuration(node.value.timestamp - node.value.start_timestamp, 2, true),
    },
    {
      key: 'previous_span',
      subject: t('Previous Span'),
      value: `${node.previous.value.op} - ${node.previous.value.description}`,
    },
    {
      key: 'next_span',
      subject: t('Next Span'),
      value: `${node.next.value.op} - ${node.next.value.description}`,
    },
  ];

  if (profileId && project?.slug) {
    items.push({
      key: 'profile_id',
      subject: 'Profile ID',
      value: (
        <TraceDrawerComponents.CopyableCardValueWithLink
          value={profileId}
          linkTarget={generateProfileFlamechartRouteWithQuery({
            organization,
            projectSlug: project.slug,
            profileId,
          })}
          linkText={t('View Profile')}
        />
      ),
    });
  }

  if (parentTransaction) {
    items.push({
      key: 'parent_transaction',
      subject: t('Parent Transaction'),
      value: (
        <a onClick={() => onParentClick(parentTransaction)}>
          {getTraceTabTitle(parentTransaction)}
        </a>
      ),
    });
  }

  return (
    <TraceDrawerComponents.DetailContainer>
      <TraceDrawerComponents.LegacyHeaderContainer>
        <TraceDrawerComponents.Title>
          <TraceDrawerComponents.IconTitleWrapper>
            <TraceDrawerComponents.IconBorder
              backgroundColor={makeTraceNodeBarColor(theme, node)}
            >
              <IconSpan size="md" />
            </TraceDrawerComponents.IconBorder>
            <div style={{fontWeight: 'bold'}}>{t('Missing Instrumentation')}</div>
          </TraceDrawerComponents.IconTitleWrapper>
        </TraceDrawerComponents.Title>
        <TraceDrawerComponents.NodeActions
          organization={organization}
          node={node}
          onTabScrollToNode={onTabScrollToNode}
        />
      </TraceDrawerComponents.LegacyHeaderContainer>
      <TraceDrawerComponents.BodyContainer>
        {node.event?.projectSlug ? (
          <ProfilesProvider
            orgSlug={organization.slug}
            projectSlug={node.event?.projectSlug ?? ''}
            profileMeta={profileId || ''}
          >
            <ProfileContext.Consumer>
              {profiles => (
                <ProfileGroupProvider
                  type="flamechart"
                  input={profiles?.type === 'resolved' ? profiles.data : null}
                  traceID={profileId || ''}
                >
                  <ProfilePreview event={node.event!} node={node} />
                </ProfileGroupProvider>
              )}
            </ProfileContext.Consumer>
          </ProfilesProvider>
        ) : null}

        <TraceDrawerComponents.SectionCard items={items} title={t('General')} />
      </TraceDrawerComponents.BodyContainer>
    </TraceDrawerComponents.DetailContainer>
  );
}
