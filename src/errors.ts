import { CustomError } from 'ts-custom-error';
import { AlertVariant as Severity } from '@grafana/ui';

// Ref: https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
// export class BaseError extends Error {
//     constructor(m: string) {
//         super(m);

//         Object.setPrototypeOf(this, BaseError.prototype);
//     }
// }s
// instanceof seems also not working.

export class UserFriendlyError extends CustomError {
  shortMessage = 'Unspecified Error';
  severity?: Severity;
  cause?: Error; // TODO: how to properly chain errors in JS?

  constructor(message: string, cause?: Error) {
    super(message);
    this.cause = cause;
  }
}

export function getIconFromSeverity(severity: Severity): string {
  switch (severity) {
    case 'error':
    case 'warning':
      return 'exclamation-triangle';
    case 'info':
      return 'info-circle';
    case 'success':
      return 'check';
    default:
      return '';
  }
}

export class InformationalError extends UserFriendlyError {
  shortMessage = 'Unspecified Informational Error';
  severity = 'info' as Severity;
}

export class SignificantError extends UserFriendlyError {
  shortMessage = 'Unspecified Significant Error';
  severity = 'error' as Severity;
}

export class NoDataError extends InformationalError {
  shortMessage = 'No Data';
}

export class InvalidSchemaError extends SignificantError {
  shortMessage = 'Invalid Schema';
}

export class GeoIPResolutionError extends SignificantError {
  shortMessage = 'Error when querying GeoIP';
}

export class AssertionError extends SignificantError {
  shortMessage = 'Assertion failed';
}

export function assert(condition: any, message?: string) {
  if (!Boolean(condition)) {
    throw new AssertionError(message ?? 'No further details attached.');
  }
}

// export class TimerangeOverflowError extends SignificantError {
//   shortMessage = 'Time Range Too Large'
// }
