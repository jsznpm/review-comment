export const EXIT = Object.freeze({ OK: 0, INPUT: 1, AUTH: 2, NOT_FOUND: 3, PARTIAL: 4 });

export class CliError extends Error {
  constructor(message, exitCode = EXIT.INPUT) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

export class HttpError extends CliError {
  constructor(message, status, exitCode) {
    super(message, exitCode);
    this.name = 'HttpError';
    this.status = status;
  }
}
