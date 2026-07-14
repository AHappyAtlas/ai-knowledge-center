import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

export const appRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const userHome = os.homedir();
export const stateRoot = path.resolve(process.env['AIKC_HOME'] ?? path.join(userHome, '.ai-knowledge-center'));
export const workspaceRoot = path.resolve(process.env['AIKC_WORKSPACE'] ?? userHome);
export const configDir = path.resolve(process.env['AIKC_CONFIG_DIR'] ?? path.join(stateRoot, 'config'));
export const registryPath = path.join(configDir, 'projects.json');
export const registryExamplePath = path.join(configDir, 'projects.example.json');
export const clientDistPath = path.join(appRoot, 'dist', 'client');
