import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const windowsTaskName = 'AI Knowledge Center';
const macLaunchAgentLabel = 'com.ai-knowledge-center.dashboard';

export type AutostartAction = 'install' | 'uninstall' | 'status';

export interface AutostartOptions {
  action: AutostartAction;
  cliPath: string;
  args: string[];
}

function quoteWindowsCommand(value: string): string {
  return `"${value.replaceAll('"', '\\"')}"`;
}

function windowsTaskCommand(options: AutostartOptions): string {
  return [process.execPath, options.cliPath, ...options.args].map(quoteWindowsCommand).join(' ');
}

function macLaunchAgentPath(): string {
  return path.join(os.homedir(), 'Library', 'LaunchAgents', `${macLaunchAgentLabel}.plist`);
}

function escapePlist(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function macPlist(options: AutostartOptions): string {
  const args = [process.execPath, options.cliPath, ...options.args]
    .map(arg => `    <string>${escapePlist(arg)}</string>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${macLaunchAgentLabel}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>StandardOutPath</key>
  <string>${escapePlist(path.join(os.homedir(), 'Library', 'Logs', 'ai-knowledge-center.out.log'))}</string>
  <key>StandardErrorPath</key>
  <string>${escapePlist(path.join(os.homedir(), 'Library', 'Logs', 'ai-knowledge-center.err.log'))}</string>
</dict>
</plist>
`;
}

async function installWindows(options: AutostartOptions): Promise<void> {
  await execFileAsync('schtasks', [
    '/Create',
    '/F',
    '/SC',
    'ONLOGON',
    '/TN',
    windowsTaskName,
    '/TR',
    windowsTaskCommand(options),
    '/RL',
    'LIMITED',
  ]);
}

async function uninstallWindows(): Promise<void> {
  await execFileAsync('schtasks', ['/Delete', '/F', '/TN', windowsTaskName]);
}

async function statusWindows(): Promise<boolean> {
  try {
    await execFileAsync('schtasks', ['/Query', '/TN', windowsTaskName]);
    return true;
  } catch {
    return false;
  }
}

async function installMac(options: AutostartOptions): Promise<void> {
  const plistPath = macLaunchAgentPath();
  await fs.mkdir(path.dirname(plistPath), { recursive: true });
  await fs.writeFile(plistPath, macPlist(options), 'utf8');
  await execFileAsync('launchctl', ['unload', plistPath]).catch(() => undefined);
  await execFileAsync('launchctl', ['load', '-w', plistPath]);
}

async function uninstallMac(): Promise<void> {
  const plistPath = macLaunchAgentPath();
  await execFileAsync('launchctl', ['unload', plistPath]).catch(() => undefined);
  await fs.rm(plistPath, { force: true });
}

async function statusMac(): Promise<boolean> {
  try {
    await execFileAsync('launchctl', ['list', macLaunchAgentLabel]);
    return true;
  } catch {
    try {
      await fs.access(macLaunchAgentPath());
      return true;
    } catch {
      return false;
    }
  }
}

export async function runAutostart(options: AutostartOptions): Promise<boolean | undefined> {
  if (process.platform === 'win32') {
    if (options.action === 'install') {
      await installWindows(options);
      return undefined;
    }
    if (options.action === 'uninstall') {
      await uninstallWindows();
      return undefined;
    }
    return statusWindows();
  }

  if (process.platform === 'darwin') {
    if (options.action === 'install') {
      await installMac(options);
      return undefined;
    }
    if (options.action === 'uninstall') {
      await uninstallMac();
      return undefined;
    }
    return statusMac();
  }

  throw new Error(`Autostart is only supported on Windows and macOS. Current platform: ${process.platform}`);
}
