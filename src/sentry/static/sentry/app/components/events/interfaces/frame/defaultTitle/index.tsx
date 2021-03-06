import React from 'react';
import styled from '@emotion/styled';

import AnnotatedText from 'app/components/events/meta/annotatedText';
import {getMeta} from 'app/components/events/meta/metaProxy';
import ExternalLink from 'app/components/links/externalLink';
import {STACKTRACE_PREVIEW_TOOLTIP_DELAY} from 'app/components/stacktracePreview';
import Tooltip from 'app/components/tooltip';
import Truncate from 'app/components/truncate';
import {IconOpen, IconQuestion} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Frame, Meta, PlatformType} from 'app/types';
import {defined, isUrl} from 'app/utils';

import FunctionName from '../functionName';
import {getPlatform, isDotnet, trimPackage} from '../utils';

import OriginalSourceInfo from './originalSourceInfo';

type Props = {
  frame: Frame;
  platform: PlatformType;
  /**
   * Is the stack trace being previewed in a hovercard?
   */
  isHoverPreviewed?: boolean;
};

type GetPathNameOutput = {key: string; value: string; meta?: Meta};

const DefaultTitle = ({frame, platform, isHoverPreviewed}: Props) => {
  const title: Array<React.ReactElement> = [];
  const framePlatform = getPlatform(frame.platform, platform);
  const tooltipDelay = isHoverPreviewed ? STACKTRACE_PREVIEW_TOOLTIP_DELAY : undefined;

  const handleExternalLink = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
  };

  const getPathName = (
    shouldPrioritizeModuleName: boolean
  ): GetPathNameOutput | undefined => {
    if (shouldPrioritizeModuleName) {
      if (frame.module) {
        return {
          key: 'module',
          value: frame.module,
          meta: getMeta(frame, 'module'),
        };
      }
      if (frame.filename) {
        return {
          key: 'filename',
          value: frame.filename,
          meta: getMeta(frame, 'filename'),
        };
      }
      return undefined;
    }

    if (frame.filename) {
      return {
        key: 'filename',
        value: frame.filename,
        meta: getMeta(frame, 'filename'),
      };
    }

    if (frame.module) {
      return {
        key: 'module',
        value: frame.module,
        meta: getMeta(frame, 'module'),
      };
    }

    return undefined;
  };

  // TODO(dcramer): this needs to use a formatted string so it can be
  // localized correctly
  if (defined(frame.filename || frame.module)) {
    // prioritize module name for Java as filename is often only basename
    const shouldPrioritizeModuleName = framePlatform === 'java';

    // we do not want to show path in title on csharp platform
    const pathName = isDotnet(framePlatform)
      ? undefined
      : getPathName(shouldPrioritizeModuleName);
    const enablePathTooltip = defined(frame.absPath) && frame.absPath !== pathName?.value;

    if (pathName) {
      title.push(
        <Tooltip
          key={pathName.key}
          title={frame.absPath}
          disabled={!enablePathTooltip}
          delay={tooltipDelay}
        >
          <code key="filename" className="filename">
            <AnnotatedText
              value={<Truncate value={pathName.value} maxLength={100} leftTrim />}
              meta={pathName.meta}
            />
          </code>
        </Tooltip>
      );
    }

    // in case we prioritized the module name but we also have a filename info
    // we want to show a litle (?) icon that on hover shows the actual filename
    if (shouldPrioritizeModuleName && frame.filename) {
      title.push(
        <Tooltip key={frame.filename} title={frame.filename} delay={tooltipDelay}>
          <a className="in-at real-filename">
            <IconQuestion size="xs" />
          </a>
        </Tooltip>
      );
    }

    if (frame.absPath && isUrl(frame.absPath)) {
      title.push(
        <StyledExternalLink href={frame.absPath} key="share" onClick={handleExternalLink}>
          <IconOpen size="xs" />
        </StyledExternalLink>
      );
    }

    if ((defined(frame.function) || defined(frame.rawFunction)) && defined(pathName)) {
      title.push(
        <span className="in-at" key="in">
          {` ${t('in')} `}
        </span>
      );
    }
  }

  if (defined(frame.function) || defined(frame.rawFunction)) {
    title.push(<FunctionName frame={frame} key="function" className="function" />);
  }

  // we don't want to render out zero line numbers which are used to
  // indicate lack of source information for native setups.  We could
  // TODO(mitsuhiko): only do this for events from native platforms?
  if (defined(frame.lineNo) && frame.lineNo !== 0) {
    title.push(
      <span className="in-at in-at-line" key="no">
        {` ${t('at line')} `}
      </span>
    );
    title.push(
      <code key="line" className="lineno">
        {defined(frame.colNo) ? `${frame.lineNo}:${frame.colNo}` : frame.lineNo}
      </code>
    );
  }

  if (defined(frame.package) && !isDotnet(framePlatform)) {
    title.push(
      <span className="within" key="within">
        {` ${t('within')} `}
      </span>
    );
    title.push(
      <code title={frame.package} className="package" key="package">
        {trimPackage(frame.package)}
      </code>
    );
  }

  if (defined(frame.origAbsPath)) {
    title.push(
      <Tooltip
        key="info-tooltip"
        title={<OriginalSourceInfo mapUrl={frame.mapUrl} map={frame.map} />}
        delay={tooltipDelay}
      >
        <a className="in-at original-src">
          <IconQuestion size="xs" />
        </a>
      </Tooltip>
    );
  }

  return <React.Fragment>{title}</React.Fragment>;
};

const StyledExternalLink = styled(ExternalLink)`
  position: relative;
  top: 2px;
  margin-left: ${space(0.5)};
`;

export default DefaultTitle;
