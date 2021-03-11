// synchronizaiton-related utils

import { Sema as Semaphore, RateLimit } from 'async-sema';

import { assert } from '../errors';

// https://stackoverflow.com/questions/46946380/fetch-api-request-timeout
export function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise(function (resolve, reject) {
    setTimeout(function () {
      reject(new Error('timeout'));
    }, ms);
    promise.then(resolve, reject);
  });
}

/**
 * Batch executing promises with throttling.
 *
 * @param tasks As is.
 * @param concurrent The maximum number of promises that runs conncurrently.
 * @param rps The maximum number of promises (requests) to run per second.
 */
export async function batch_with_throttle<V>(
  tasks: Array<() => Promise<V>>,
  concurrent?: number,
  rps?: number
): Promise<V[]> {
  let sema = new Semaphore(concurrent ?? tasks.length);
  let lim = RateLimit(rps ?? tasks.length, { uniformDistribution: true });
  return await Promise.all(
    tasks.map(async (task) => {
      await sema.acquire();
      await lim();
      try {
        return await task();
      } finally {
        await sema.release();
      }
    })
  );
}

export interface ThrottableFn<P0, PN extends any[], R> {
  (arg0: P0, ...args: PN): Promise<R>;
}

export interface Throttler<P0, PN extends any[], R> {
  (fn: ThrottableFn<P0, PN, R>): ThrottableFn<P0, PN, R>;
}

/**
 * Make a thorttler that wraps a function with synchronization primitives so that the function is
 * rate-limited according to the params `concurrent` and `rps`.
 *
 * @param concurrent The maximum number of promises that runs conncurrently.
 * @param rps The maximum number of promises (requests) to run per second.
 */
export function makeThrottler<P0, PN extends any[], R>(concurrent: number, rps: number): Throttler<P0, PN, R> {
  assert(concurrent > 0 && rps > 0);
  let sema = new Semaphore(concurrent);
  let limt = RateLimit(rps, { uniformDistribution: true });

  function throttler(fn: ThrottableFn<P0, PN, R>): ThrottableFn<P0, PN, R> {
    async function wrapped(arg0: P0, ...args: PN): Promise<R> {
      await sema.acquire();
      await limt();
      try {
        return await fn(arg0, ...args);
      } finally {
        await sema.release();
      }
    }
    return wrapped;
  }
  return throttler;
}
