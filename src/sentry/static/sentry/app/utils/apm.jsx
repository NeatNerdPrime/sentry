import * as Router from 'react-router';
import * as Sentry from '@sentry/browser';

let firstPageLoad = true;

function startTransaction() {
  // We do set the transaction name in the router but we want to start it here
  // since in the App component where we set the transaction name, it's called multiple
  // times. This would result in losing the start of the transaction.
  const hub = Sentry.getCurrentHub();
  hub.configureScope(scope => {
    if (firstPageLoad) {
      firstPageLoad = false;
    } else {
      const prevTransactionSpan = scope.getSpan();
      // If there is a transaction we set the name to the route
      if (prevTransactionSpan && prevTransactionSpan.timestamp === undefined) {
        hub.finishSpan(prevTransactionSpan);
      }
      Sentry.startSpan(
        {
          op: 'navigation',
          sampled: true,
        },
        true
      );
    }
  });

  finishTransaction(5000);
}

const requests = new Map([]);
const renders = new Map([]);
let flushTransactionTimeout = undefined;
let interruptFlush = false;
export function finishTransaction(delay) {
  if (flushTransactionTimeout) {
    clearTimeout(flushTransactionTimeout);
  }
  if (
    Array.from(requests).find(([, active]) => active) ||
    Array.from(renders).find(([, active]) => active)
  ) {
    clearTimeout(flushTransactionTimeout);
  }
  flushTransactionTimeout = setTimeout(() => {
    Sentry.finishSpan();
  }, delay || 5000);
}

export function startRequest(id) {
  // if flush is active, stop it
  if (flushTransactionTimeout) {
    clearTimeout(flushTransactionTimeout);
    interruptFlush = true;
  }

  requests.set(id, true);
}
export function finishRequest(id) {
  requests.set(id, false);

  if (
    interruptFlush &&
    !Array.from(requests).find(([, active]) => active) &&
    !Array.from(renders).find(([, active]) => active)
  ) {
    finishTransaction(1);
  }
}

export function startRender(id) {
  // if flush is active, stop it
  if (flushTransactionTimeout) {
    clearTimeout(flushTransactionTimeout);
    interruptFlush = true;
  }

  renders.set(id, true);
}

export function finishRender(id) {
  renders.set(id, false);

  // if flush is active, stop it
  if (flushTransactionTimeout) {
    clearTimeout(flushTransactionTimeout);
    interruptFlush = true;
  }

  if (
    interruptFlush &&
    !Array.from(requests).find(([, active]) => active) &&
    !Array.from(renders).find(([, active]) => active)
  ) {
    finishTransaction(1);
  }
}

export function startApm() {
  Sentry.startSpan(
    {
      op: 'pageload',
      sampled: true,
    },
    true
  );
  startTransaction();
  Router.browserHistory.listen(() => startTransaction());
}

window.billy = [requests, renders];
