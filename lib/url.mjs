import { CliError, EXIT } from './errors.mjs';

const GITHUB_PR = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/.*)?$/;
const GITLAB_MR = /^\/(.+?)\/-\/merge_requests\/(\d+)(?:\/.*)?$/;

function unsupported(input) {
  return new CliError(
    `unsupported merge request URL: ${input}\n` +
      'expected https://github.com/<owner>/<repo>/pull/<n> or https://<gitlab-host>/<group>/<project>/-/merge_requests/<n>',
    EXIT.INPUT,
  );
}

export function parseMrUrl(input) {
  let u;
  try {
    u = new URL(String(input).trim());
  } catch {
    throw unsupported(input);
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw unsupported(input);

  const host = u.host.toLowerCase();
  const path = u.pathname.replace(/\/+$/, '');

  if (host === 'github.com' || host === 'www.github.com') {
    const m = GITHUB_PR.exec(path);
    if (!m) throw unsupported(input);
    const project = `${m[1]}/${m[2]}`;
    const number = Number(m[3]);
    return {
      platform: 'github',
      host: 'github.com',
      origin: 'https://github.com',
      project,
      number,
      url: `https://github.com/${project}/pull/${number}`,
    };
  }

  const m = GITLAB_MR.exec(path);
  if (!m || !m[1].includes('/')) throw unsupported(input);
  const project = decodeURIComponent(m[1]);
  const number = Number(m[2]);
  const origin = `${u.protocol}//${host}`;
  return {
    platform: 'gitlab',
    host,
    origin,
    project,
    number,
    url: `${origin}/${project}/-/merge_requests/${number}`,
  };
}
