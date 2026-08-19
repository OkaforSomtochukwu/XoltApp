const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the whole monorepo so changes in packages/* trigger a refresh.
// Hierarchical node_modules lookup stays on (the default) so Metro's normal
// upward walk — which follows pnpm's symlinks — finds every dependency,
// hoisted or not. Turning it off requires pnpm to hoist every transitive
// dependency flat, which it doesn't do reliably in this workspace.
config.watchFolders = [workspaceRoot];

module.exports = config;
