import {debounce} from 'lodash';
import React, {unstable_Profiler as ReactProfiler} from 'react';
import * as Sentry from '@sentry/browser';

import {startRender, finishRender} from 'app/utils/apm';
import getDisplayName from 'app/utils/getDisplayName';

class Profiler {
  spansById = new Map([]);

  dispose() {
    this.spansById = new Map([]);
  }

  commit = debounce((id, span, timestamp) => {
    span.timestamp = timestamp;
    span.finishedSpans.push(span);
    Sentry.finishSpan(span);
    finishRender(id);
  }, 500);

  handleRender = (
    id,
    phase,
    actualDuration,
    _baseDuration,
    startTime,
    _commitTime,
    _interactions
  ) => {
    let span;
    const start = window.performance && window.performance.timing.navigationStart;

    if (phase === 'mount') {
      startRender(id);
      span = Sentry.startSpan({
        data: {},
        op: 'react',
        description: `render <${id}>`,
      });
      span.startTimestamp = (start + startTime) / 1000;
      this.commit(id, span, (start + startTime + actualDuration) / 1000);
      this.spansById.set(id, span);
    } else {
      span = this.spansById.get(id);

      if (span) {
        // yikes
        span.timestamp = (start + startTime + actualDuration) / 1000;
      }
    }
  };
}

export default function profiler() {
  return WrappedComponent => {
    return class extends React.Component {
      componentWillUnmount() {
        this.profiler.dispose();
        this.profiler = null;
      }

      profiler = new Profiler();

      render() {
        return (
          <ReactProfiler
            id={getDisplayName(WrappedComponent)}
            onRender={this.profiler.handleRender}
          >
            <WrappedComponent {...this.props} />
          </ReactProfiler>
        );
      }
    };
  };
}

/*
const finishSpan = function (span) {
  var top = this.getStackTop();
  var passedSpan = span;
  // If the passed span is undefined we try to get the span from the scope and finish it.
  if (passedSpan === undefined) {
      if (top.scope && top.client) {
          var scopeSpan = top.scope.getSpan();
          if (scopeSpan) {
              passedSpan = scopeSpan;
          }
      }
  }
  if (passedSpan === undefined) {
      _sentry_utils__WEBPACK_IMPORTED_MODULE_1__["logger"].warn('There was no Span on the Scope and none was passed, do nothing.');
      // We will do nothing since nothing was passed and there is no Span on the scope.
      return undefined;
  }
  if (!passedSpan.timestamp) {
      passedSpan.finish();
  }
  if (!passedSpan.transaction) {
      return undefined;
  }
  if (!top.client) {
      return undefined;
  }
  // TODO: if sampled do what?
  var finishedSpans = passedSpan.finishedSpans.filter(function (s) { return s !== passedSpan; });
  var eventId = this.captureEvent({
      contexts: { trace: passedSpan.getTraceContext() },
      spans: finishedSpans.length > 0 ? finishedSpans : undefined,
      start_timestamp: passedSpan.startTimestamp,
      timestamp: passedSpan.timestamp,
      transaction: passedSpan.transaction,
      type: 'transaction',
  });
  // After sending we reset the finishedSpans array
  passedSpan.finishedSpans = [];
  return eventId;
};
*/
