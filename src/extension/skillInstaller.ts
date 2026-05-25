import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const BUNDLED_SKILL_NAMES = ['p8mod-author'];
const CANONICAL_SKILL_DIR = '.pico8ide-skills';

function copyDirectory(sourceDir: string, targetDir: string) {
    fs.mkdirSync(targetDir, { recursive: true });

    for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
        const sourcePath = path.join(sourceDir, entry.name);
        const targetPath = path.join(targetDir, entry.name);

        if (entry.isDirectory()) {
            copyDirectory(sourcePath, targetPath);
        } else if (entry.isFile()) {
            fs.copyFileSync(sourcePath, targetPath);
        }
    }
}

function writeFileIfChanged(filePath: string, content: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf-8') === content) {
        return;
    }
    fs.writeFileSync(filePath, content, 'utf-8');
}

function skillWrapper(toolName: string): string {
    return `# p8mod-author

This is the ${toolName} adapter for the workspace's Pico-8 IDE p8mod skill.

When creating, editing, generating, or validating Pico-8 IDE \`.p8mod\` cartridges, read the canonical workspace skill first:

- \`${CANONICAL_SKILL_DIR}/p8mod-author/SKILL.md\`

Follow that skill's validation contract. Prefer:

\`\`\`bash
node ${CANONICAL_SKILL_DIR}/p8mod-author/scripts/validate-p8mod.mjs path/to/game.p8mod
\`\`\`

If Node.js is unavailable, use:

\`\`\`bash
python3 ${CANONICAL_SKILL_DIR}/p8mod-author/scripts/validate-p8mod.py path/to/game.p8mod
\`\`\`

If neither runtime exists, report validation as blocked and perform the manual checks documented by the canonical skill.
`;
}

function installToolWrappers(workspaceRoot: string) {
    writeFileIfChanged(
        path.join(workspaceRoot, '.codex', 'skills', 'p8mod-author', 'SKILL.md'),
        `---
name: p8mod-author
description: Use when creating, editing, generating, or validating Pico-8 IDE .p8mod cartridges; read ${CANONICAL_SKILL_DIR}/p8mod-author/SKILL.md and run its validators.
---

${skillWrapper('Codex')}`
    );

    writeFileIfChanged(
        path.join(workspaceRoot, '.claude', 'skills', 'p8mod-author', 'SKILL.md'),
        `---
name: p8mod-author
description: Use when creating, editing, generating, or validating Pico-8 IDE .p8mod cartridges; read ${CANONICAL_SKILL_DIR}/p8mod-author/SKILL.md and run its validators.
---

${skillWrapper('Claude Code')}`
    );

    writeFileIfChanged(
        path.join(workspaceRoot, '.github', 'instructions', 'pico8ide-p8mod.instructions.md'),
        skillWrapper('Copilot')
    );
}

export async function installBundledAgentSkills(context: vscode.ExtensionContext, locale: {
    installAgentSkillsNoWorkspace: string;
    installAgentSkillsMissing: string;
    installAgentSkillsSuccess: string;
}) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage(locale.installAgentSkillsNoWorkspace);
        return;
    }

    const bundledRoot = path.join(context.extensionPath, 'resources', CANONICAL_SKILL_DIR);
    if (!fs.existsSync(bundledRoot)) {
        vscode.window.showErrorMessage(locale.installAgentSkillsMissing);
        return;
    }

    const workspaceRoot = workspaceFolder.uri.fsPath;
    const targetRoot = path.join(workspaceRoot, CANONICAL_SKILL_DIR);
    for (const skillName of BUNDLED_SKILL_NAMES) {
        const sourceDir = path.join(bundledRoot, skillName);
        if (!fs.existsSync(path.join(sourceDir, 'SKILL.md'))) {
            vscode.window.showErrorMessage(`${locale.installAgentSkillsMissing}: ${skillName}`);
            return;
        }
        copyDirectory(sourceDir, path.join(targetRoot, skillName));
    }

    installToolWrappers(workspaceRoot);

    vscode.window.showInformationMessage(
        locale.installAgentSkillsSuccess.replace('{count}', String(BUNDLED_SKILL_NAMES.length))
    );
}
