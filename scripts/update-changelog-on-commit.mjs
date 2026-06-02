import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function runGit(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    cwd: options.cwd,
  }).trim();
}

function tryRunGit(args, options = {}) {
  try {
    return runGit(args, options);
  } catch {
    return "";
  }
}

function getCommitSubject(commitMsgFile) {
  const raw = readFileSync(commitMsgFile, "utf8");
  return (
    raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !line.startsWith("#")) ?? ""
  );
}

function parseStagedEntries(raw) {
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/);
      if (parts.length < 2) return null;
      const status = parts[0];
      const filePath = parts[parts.length - 1];
      return { status, filePath };
    })
    .filter((entry) => entry !== null);
}

function ensureUnreleasedSection(changelog) {
  if (changelog.includes("## [Unreleased]")) return changelog;
  const base = changelog.trimEnd();
  return `${base}\n\n## [Unreleased]\n`;
}

function normalizeSubject(subject) {
  const normalized = subject.trim();
  if (!normalized) return "";
  if (/^\d+$/.test(normalized)) return "";
  if (/^(wip|update|changes?|misc)$/i.test(normalized)) return "";
  return normalized;
}

function classifyChange(entries, subject) {
  const normalizedSubject = subject.toLowerCase();
  if (/\b(fix|bugfix|repair)\b|修复|错误|缺陷/.test(normalizedSubject)) {
    return "Fixed";
  }
  if (entries.every((entry) => entry.status[0] === "D")) {
    return "Removed";
  }
  if (entries.some((entry) => entry.status[0] === "A")) {
    return "Added";
  }
  return "Changed";
}

function describeHeuristicChange({ subject, entries, category }) {
  const normalizedSubject = normalizeSubject(subject);
  if (normalizedSubject) {
    return normalizedSubject.replace(/[。.]$/, "");
  }

  const files = entries.map((entry) => entry.filePath);
  const hasDocsArchive = entries.some(
    (entry) =>
      entry.status[0] === "R" &&
      (entry.filePath.startsWith("docs/archive/") || entry.filePath.endsWith(".md"))
  );
  if (hasDocsArchive) {
    return "归档开发过程文档，保持仓库根目录更清爽";
  }

  if (
    files.some((file) =>
      ["LICENSE", "README.md", "package.json", "package-lock.json"].includes(file)
    ) ||
    files.some((file) => file.startsWith("src/lib/site"))
  ) {
    return "完善开源项目元数据、仓库链接与文档说明";
  }

  if (files.some((file) => file.startsWith("scripts/") || file.startsWith(".githooks/"))) {
    return "改进项目维护脚本与自动化流程";
  }

  if (files.some((file) => file.startsWith("tests/"))) {
    return "补充或更新回归测试";
  }

  if (files.some((file) => file.startsWith("src/lib/"))) {
    return "更新核心数值计算逻辑";
  }

  if (files.some((file) => file.startsWith("src/app/") || file.startsWith("src/components/"))) {
    return "更新前端界面与交互体验";
  }

  if (category === "Added") return "新增项目文件或功能";
  if (category === "Removed") return "移除不再需要的项目内容";
  if (category === "Fixed") return "修复项目问题";
  return "更新项目内容";
}

function insertEntry(changelog, category, entry) {
  const normalized = ensureUnreleasedSection(changelog).replace(/\r\n/g, "\n");
  const unreleasedPattern = /## \[Unreleased\][\s\S]*?(?=\n## \[|$)/;
  const match = normalized.match(unreleasedPattern);

  if (!match) {
    return `${normalized.trimEnd()}\n\n## [Unreleased]\n\n### ${category}\n\n${entry}\n`;
  }

  const unreleasedBlock = match[0];
  const sectionHeading = `### ${category}`;
  const sectionPattern = new RegExp(
    `### ${category}\\n[\\s\\S]*?(?=\\n### |$)`
  );
  let nextBlock = unreleasedBlock;

  if (unreleasedBlock.includes(entry)) {
    return normalized;
  }

  if (unreleasedBlock.includes(sectionHeading)) {
    nextBlock = unreleasedBlock.replace(sectionPattern, (section) => {
      const trimmed = section.trimEnd();
      return `${trimmed}\n${entry}\n`;
    });
  } else {
    nextBlock = `${unreleasedBlock.trimEnd()}\n\n${sectionHeading}\n\n${entry}\n`;
  }

  return normalized.replace(unreleasedPattern, nextBlock);
}

function quoteForShell(value) {
  return `"${String(value).replace(/(["\\$`])/g, "\\$1")}"`;
}

function getConfiguredCodexCommand(repoRoot) {
  const fromEnv = (process.env.CODEX_CHANGELOG_COMMAND ?? "").trim();
  if (fromEnv) return fromEnv;

  const fromGitConfig = tryRunGit(["config", "--get", "hooks.codexChangelogCommand"], {
    cwd: repoRoot,
  }).trim();

  return fromGitConfig;
}

function isCodexAvailable() {
  try {
    execFileSync("codex", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function isChangelogTouched(repoRoot) {
  const staged = tryRunGit(["diff", "--cached", "--name-only", "--", "CHANGELOG.md"], {
    cwd: repoRoot,
  });
  const unstaged = tryRunGit(["diff", "--name-only", "--", "CHANGELOG.md"], {
    cwd: repoRoot,
  });
  return Boolean(staged || unstaged);
}

function applyHeuristicUpdate({ repoRoot, changelogPath, subject, entries }) {
  const category = classifyChange(entries, subject);
  const summary = describeHeuristicChange({ subject, entries, category });
  const entry = `- ${summary}。`;

  const initial = "# Changelog\n\n## [Unreleased]\n";
  const existing = existsSync(changelogPath)
    ? readFileSync(changelogPath, "utf8")
    : initial;
  const updated = insertEntry(existing, category, entry).trimEnd() + "\n";

  writeFileSync(changelogPath, updated, "utf8");
  runGit(["add", "CHANGELOG.md"], { cwd: repoRoot });
}

function buildDefaultCodexPrompt({ commitSubject, changedFiles, stagedDiffPath, changelogPath }) {
  return [
    "你是资深软件工程师，目标是在本次提交前智能更新 CHANGELOG.md。",
    "",
    "严格要求：",
    "1. 只修改 CHANGELOG.md。",
    "2. 基于已暂存改动与提交主题，写入 ## [Unreleased] 下的变更记录。",
    "3. 使用简洁中文，按 Added / Changed / Fixed（按需）分类。",
    "4. 不要杜撰未出现在改动中的功能。",
    "5. 若已有同类条目，合并措辞避免重复。",
    "",
    `提交主题: ${commitSubject}`,
    `变更文件: ${changedFiles.join(", ")}`,
    `CHANGELOG 路径: ${changelogPath}`,
    `已暂存 diff 文件: ${stagedDiffPath}`,
  ].join("\n");
}

function runCodexUpdate({ repoRoot, changelogPath, commitMsgFile, subject, entries }) {
  const changedFiles = entries.map((entry) => entry.filePath);
  const stagedDiff = tryRunGit(["diff", "--cached", "--no-color", "--minimal"], {
    cwd: repoRoot,
  });

  const hookTmpDir = path.join(repoRoot, ".git", ".changelog-hook");
  mkdirSync(hookTmpDir, { recursive: true });

  const stagedDiffPath = path.join(hookTmpDir, "staged.diff");
  const stagedFilesPath = path.join(hookTmpDir, "staged-files.json");
  writeFileSync(stagedDiffPath, stagedDiff, "utf8");
  writeFileSync(stagedFilesPath, JSON.stringify(changedFiles, null, 2), "utf8");

  const customCmd = getConfiguredCodexCommand(repoRoot);
  if (customCmd) {
    const resolved = customCmd
      .replaceAll("{REPO_ROOT}", quoteForShell(repoRoot))
      .replaceAll("{CHANGELOG}", quoteForShell(changelogPath))
      .replaceAll("{COMMIT_MSG}", quoteForShell(commitMsgFile))
      .replaceAll("{STAGED_DIFF}", quoteForShell(stagedDiffPath))
      .replaceAll("{STAGED_FILES}", quoteForShell(stagedFilesPath))
      .replaceAll("{SUBJECT}", quoteForShell(subject));

    execSync(resolved, {
      cwd: repoRoot,
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env,
        CHANGELOG_REPO_ROOT: repoRoot,
        CHANGELOG_FILE: changelogPath,
        CHANGELOG_COMMIT_MSG_FILE: commitMsgFile,
        CHANGELOG_STAGED_DIFF_FILE: stagedDiffPath,
        CHANGELOG_STAGED_FILES_FILE: stagedFilesPath,
        CHANGELOG_COMMIT_SUBJECT: subject,
      },
    });

    return true;
  }

  if (!isCodexAvailable()) {
    return false;
  }

  const prompt = buildDefaultCodexPrompt({
    commitSubject: subject,
    changedFiles,
    stagedDiffPath,
    changelogPath,
  });

  execFileSync(
    "codex",
    [
      "exec",
      "-",
      "--sandbox",
      "workspace-write",
      "--skip-git-repo-check",
      "-C",
      repoRoot,
    ],
    {
      input: prompt,
      stdio: ["pipe", "inherit", "inherit"],
      timeout: 5 * 60 * 1000,
    }
  );

  return true;
}

function main() {
  const commitMsgFile = process.argv[2];
  if (!commitMsgFile) return;

  const subject = getCommitSubject(commitMsgFile);
  if (!subject || subject.startsWith("Merge ")) return;

  const repoRoot = runGit(["rev-parse", "--show-toplevel"]);
  const changelogPath = path.join(repoRoot, "CHANGELOG.md");

  const stagedRaw = runGit(["diff", "--cached", "--name-status", "--diff-filter=ACMRD"], {
    cwd: repoRoot,
  });

  const entries = parseStagedEntries(stagedRaw).filter(
    (entry) => entry.filePath !== "CHANGELOG.md"
  );

  if (!entries.length) return;

  if (isChangelogTouched(repoRoot)) {
    return;
  }

  const requireCodex = ["1", "true", "yes"].includes(
    String(process.env.CHANGELOG_REQUIRE_CODEX ?? "").toLowerCase()
  );

  let codexSucceeded = false;
  try {
    codexSucceeded = runCodexUpdate({
      repoRoot,
      changelogPath,
      commitMsgFile,
      subject,
      entries,
    });
  } catch (error) {
    if (requireCodex) {
      throw error;
    }
    console.warn("[changelog-hook] Codex 审查失败，回退到本地规则更新。", error);
  }

  if (!codexSucceeded || !isChangelogTouched(repoRoot)) {
    applyHeuristicUpdate({
      repoRoot,
      changelogPath,
      subject,
      entries,
    });
    return;
  }

  runGit(["add", "CHANGELOG.md"], { cwd: repoRoot });
}

try {
  main();
} catch (error) {
  console.error("[changelog-hook] 更新 CHANGELOG 失败：", error);
  process.exit(1);
}
