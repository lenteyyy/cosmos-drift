import { execFileSync } from 'node:child_process';
import { readFile, lstat } from 'node:fs/promises';
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
if (!files.length)
  throw Error('No tracked files: stage the intended public release before checking.');
const violations = [];
for (const file of files) {
  if (
    /(^|\/)(node_modules|dist|\.runtime|\.git)(\/|$)|(^|\/)\.env($|\.)|\.(mp3|pem|key|zip)$/i.test(
      file,
    ) ||
    /^public\/audio\/voice\/.*\.wav$/.test(file)
  )
    violations.push(file + ': private or generated file');
  if ((await lstat(file)).isSymbolicLink()) violations.push(file + ': symbolic link');
  if (
    !/\.(mjs|js|ts|tsx|json|html|css|md|txt|yml|yaml|command)$/.test(file) &&
    !/^LICENSE$/.test(file)
  )
    continue;
  const content = await readFile(file, 'utf8');
  // Report filenames only, never print a possible credential.
  if (
    /gh[pousr]_[A-Za-z0-9]{25,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sk-[A-Za-z0-9]{32,}/.test(
      content,
    )
  )
    violations.push(file + ': possible credential');
  if (/\/Users\/[\w.-]+\//.test(content)) violations.push(file + ': personal absolute path');
}
if (violations.length) throw Error(violations.join('\n'));
console.log(
  `Release scan passed: ${files.length} tracked files; no private media, credentials, personal paths or symbolic links.`,
);
