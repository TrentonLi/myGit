#!/usr/bin/env node
const inquirer = require("inquirer");
const chalk = require("chalk");
const simpleGit = require("simple-git");
const git = simpleGit();

// 菜单选项常量
const ACTIONS = {
    STATUS: "查看状态 (git status)",
    COMMIT_PUSH: "提交代码 (add. && commit && pull && push)",
    PULL: "拉取代码 (git pull)",
    PUSH: "推送代码 (git push)",
    BRANCH_MANAGE: "分支管理 (查看/切换分支)",
    MERGE: "合并分支",
    REMOTE_MANAGE: "远程仓库管理",
    EXIT: "退出"
};

const REMOTE_ACTIONS = {
    ADD: "添加远程仓库",
    UPDATE: "修改远程仓库地址",
    DELETE: "删除远程仓库",
    BACK: "返回"
};

/**
 * 统一错误处理
 */
function handleError(err, operation) {
    console.log(chalk.red(`❌ ${operation}失败: ${err.message}`));
    if (err.stderr) {
        console.log(chalk.gray(`详细信息: ${err.stderr}`));
    }
}

/**
 * 获取当前分支
 */
async function getCurrentBranch() {
    const branchSummary = await git.branch();
    return branchSummary.current;
}

/**
 * 获取远程仓库列表
 */
async function getRemotes() {
    return await git.getRemotes(true);
}

/**
 * 获取默认远程仓库（优先 origin）
 */
async function getDefaultRemote() {
    const remotes = await getRemotes();
    if (remotes.length === 0) {
        throw new Error("没有配置远程仓库");
    }
    return remotes.find(r => r.name === "origin")?.name || remotes[0]?.name;
}

/**
 * 检查是否为 Git 仓库
 */
async function checkIsRepo() {
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
        console.log(chalk.red("❌ 当前目录不是一个 Git 仓库"));
        process.exit(1);
    }
}

/**
 * 显示状态信息
 */
async function showStatus() {
    try {
        const status = await git.status();
        console.log(chalk.green(`📂 当前分支: ${status.current}`));
        console.log(chalk.blue(`🔗 跟踪分支: ${status.tracking || "无"}`));
        console.log(chalk.yellow(`📌 提交领先: ${status.ahead}, 落后: ${status.behind}`));

        if (status.modified.length > 0) {
            console.log(chalk.red("✏️ 已修改文件:"), status.modified);
        }
        if (status.not_added.length > 0) {
            console.log(chalk.yellow("📝 未跟踪文件:"), status.not_added);
        }
        if (status.staged.length > 0) {
            console.log(chalk.blue("✅ 已暂存文件:"), status.staged);
        }
        if (status.modified.length === 0 && status.not_added.length === 0 && status.staged.length === 0) {
            console.log(chalk.green("✅ 工作区干净，没有修改"));
        }
    } catch (err) {
        handleError(err, "查看状态");
    }
}

/**
 * 提交并推送代码
 */
async function commitAndPush() {
    try {
        const currentBranch = await getCurrentBranch();
        
        // 检查是否有变更
        const status = await git.status();
        if (status.modified.length === 0 && status.not_added.length === 0) {
            console.log(chalk.yellow("⚠️ 没有需要提交的变更"));
            return;
        }

        const { msg } = await inquirer.prompt([
            { 
                type: "input", 
                name: "msg", 
                message: "请输入提交信息:",
                validate: (input) => input.trim().length > 0 || "提交信息不能为空"
            }
        ]);

        console.log(chalk.blue("📦 正在添加文件..."));
        await git.add(".");
        
        console.log(chalk.blue("💾 正在提交..."));
        await git.commit(msg.trim());
        console.log(chalk.green("✅ 提交成功"));

        // 拉取远程更新，避免冲突
        try {
            console.log(chalk.blue("⬇️ 正在拉取远程更新..."));
            const pullResult = await git.pull();
            console.log(chalk.blue("⬇️ 已同步远程最新代码"));
            if (pullResult.summary.changes || pullResult.summary.insertions || pullResult.summary.deletions) {
                console.log(chalk.yellow("📌 本地有变更已合并: "), pullResult.summary);
            }
        } catch (err) {
            handleError(err, "拉取");
            console.log(chalk.yellow("⚠️ 拉取失败，跳过推送以避免冲突"));
            return;
        }

        // 自动推送
        try {
            const remote = await getDefaultRemote();
            console.log(chalk.blue(`🚀 正在推送到 ${remote}/${currentBranch}...`));
            await git.push(remote, currentBranch);
            console.log(chalk.green(`🚀 已成功推送到 ${remote}/${currentBranch}`));
        } catch (err) {
            handleError(err, "推送");
        }
    } catch (err) {
        handleError(err, "提交代码");
    }
}

/**
 * 拉取代码
 */
async function pullCode() {
    try {
        console.log(chalk.blue("⬇️ 正在拉取代码..."));
        const result = await git.pull();
        console.log(chalk.green("⬇️ 拉取完成"));
        if (result.summary.changes || result.summary.insertions || result.summary.deletions) {
            console.log(chalk.yellow("📌 更新内容:"), result.summary);
        } else {
            console.log(chalk.green("✅ 已是最新版本"));
        }
    } catch (err) {
        handleError(err, "拉取");
    }
}

/**
 * 推送代码
 */
async function pushCode() {
    try {
        const remotes = await getRemotes();
        if (remotes.length === 0) {
            console.log(chalk.red("⚠️ 当前没有配置远程仓库"));
            return;
        }

        const currentBranch = await getCurrentBranch();
        const { remote, branch } = await inquirer.prompt([
            {
                type: "list",
                name: "remote",
                message: "选择远程仓库:",
                choices: remotes.map(r => r.name)
            },
            {
                type: "input",
                name: "branch",
                message: "输入要推送的分支:",
                default: currentBranch
            }
        ]);

        console.log(chalk.blue(`🚀 正在推送到 ${remote}/${branch}...`));
        await git.push(remote, branch);
        console.log(chalk.green("🚀 推送完成"));
    } catch (err) {
        handleError(err, "推送");
    }
}

/**
 * 分支管理
 */
async function manageBranches() {
    try {
        const branches = await git.branchLocal();
        const currentBranch = branches.current;

        console.log(chalk.blue(`📂 当前分支: ${currentBranch}`));
        console.log(chalk.blue("📋 所有分支:"));
        branches.all.forEach(branch => {
            const prefix = branch === currentBranch ? "👉 " : "   ";
            console.log(chalk.gray(`${prefix}${branch}`));
        });

        const { branch } = await inquirer.prompt([
            {
                type: "list",
                name: "branch",
                message: "选择要切换的分支:",
                choices: branches.all,
                default: currentBranch
            }
        ]);

        if (branch === currentBranch) {
            console.log(chalk.yellow("⚠️ 已经是当前分支"));
            return;
        }

        console.log(chalk.blue(`🔄 正在切换到分支: ${branch}...`));
        await git.checkout(branch);
        console.log(chalk.green(`✅ 已切换到分支: ${branch}`));
    } catch (err) {
        handleError(err, "切换分支");
    }
}

/**
 * 合并分支
 */
async function mergeBranch() {
    try {
        const currentBranch = await getCurrentBranch();
        const branches = await git.branchLocal();
        const availableBranches = branches.all.filter(b => b !== currentBranch);

        if (availableBranches.length === 0) {
            console.log(chalk.yellow("⚠️ 没有其他分支可合并"));
            return;
        }

        const { branch } = await inquirer.prompt([
            {
                type: "list",
                name: "branch",
                message: `选择要合并到 ${currentBranch} 的分支:`,
                choices: availableBranches
            }
        ]);

        const { confirm } = await inquirer.prompt([
            {
                type: "confirm",
                name: "confirm",
                message: `确定要将 ${branch} 合并到 ${currentBranch} 吗?`,
                default: false
            }
        ]);

        if (!confirm) {
            console.log(chalk.yellow("❌ 已取消合并"));
            return;
        }

        console.log(chalk.blue(`🔄 正在合并分支 ${branch}...`));
        await git.merge([branch]);
        console.log(chalk.green(`✅ 已成功合并分支 ${branch} 到 ${currentBranch}`));
    } catch (err) {
        handleError(err, "合并分支");
    }
}

/**
 * 添加远程仓库
 */
async function addRemote() {
    try {
        const { name, url } = await inquirer.prompt([
            { 
                type: "input", 
                name: "name", 
                message: "请输入远程仓库名称:", 
                default: "origin",
                validate: (input) => input.trim().length > 0 || "名称不能为空"
            },
            { 
                type: "input", 
                name: "url", 
                message: "请输入远程仓库地址:",
                validate: (input) => input.trim().length > 0 || "地址不能为空"
            }
        ]);
        await git.addRemote(name.trim(), url.trim());
        console.log(chalk.green(`✅ 已添加远程仓库 ${name}: ${url}`));
    } catch (err) {
        handleError(err, "添加远程仓库");
    }
}

/**
 * 更新远程仓库地址
 */
async function updateRemote() {
    try {
        const remotes = await getRemotes();
        if (remotes.length === 0) {
            console.log(chalk.red("⚠️ 当前没有可修改的远程仓库"));
            return;
        }

        const { remoteName, newUrl } = await inquirer.prompt([
            {
                type: "list",
                name: "remoteName",
                message: "选择要修改的远程仓库:",
                choices: remotes.map(r => r.name)
            },
            {
                type: "input",
                name: "newUrl",
                message: "请输入新的远程仓库地址:",
                validate: (input) => input.trim().length > 0 || "地址不能为空"
            }
        ]);
        await git.remote(["set-url", remoteName, newUrl.trim()]);
        console.log(chalk.green(`✅ 已修改远程仓库 ${remoteName} 地址为: ${newUrl}`));
    } catch (err) {
        handleError(err, "修改远程仓库");
    }
}

/**
 * 删除远程仓库
 */
async function deleteRemote() {
    try {
        const remotes = await getRemotes();
        if (remotes.length === 0) {
            console.log(chalk.red("⚠️ 当前没有可删除的远程仓库"));
            return;
        }

        const { remoteName } = await inquirer.prompt([
            {
                type: "list",
                name: "remoteName",
                message: "选择要删除的远程仓库:",
                choices: remotes.map(r => r.name)
            }
        ]);

        const { confirm } = await inquirer.prompt([
            {
                type: "confirm",
                name: "confirm",
                message: `确定要删除远程仓库 ${remoteName} 吗?`,
                default: false
            }
        ]);

        if (!confirm) {
            console.log(chalk.yellow("❌ 已取消删除"));
            return;
        }

        await git.removeRemote(remoteName);
        console.log(chalk.green(`🗑️ 已删除远程仓库: ${remoteName}`));
    } catch (err) {
        handleError(err, "删除远程仓库");
    }
}

/**
 * 远程仓库管理
 */
async function manageRemotes() {
    const remotes = await getRemotes();
    if (remotes.length === 0) {
        console.log(chalk.yellow("⚠️ 当前没有配置远程仓库"));
    } else {
        console.log(chalk.blue("📡 当前远程仓库:"));
        remotes.forEach(r => {
            console.log(chalk.green(`  - ${r.name}: ${r.refs.fetch}`));
        });
    }

    const { remoteAction } = await inquirer.prompt([
        {
            type: "list",
            name: "remoteAction",
            message: "选择远程仓库操作:",
            choices: [
                REMOTE_ACTIONS.ADD,
                REMOTE_ACTIONS.UPDATE,
                REMOTE_ACTIONS.DELETE,
                REMOTE_ACTIONS.BACK
            ]
        }
    ]);

    switch (remoteAction) {
        case REMOTE_ACTIONS.ADD:
            await addRemote();
            break;
        case REMOTE_ACTIONS.UPDATE:
            await updateRemote();
            break;
        case REMOTE_ACTIONS.DELETE:
            await deleteRemote();
            break;
        case REMOTE_ACTIONS.BACK:
            break;
    }
}

/**
 * 显示主菜单
 */
async function showMainMenu() {
    const currentBranch = await getCurrentBranch();
    console.log(chalk.blue(`\n📂 当前分支: ${currentBranch}\n`));

    const { action } = await inquirer.prompt([
        {
            type: "list",
            name: "action",
            message: "请选择要执行的操作",
            choices: [
                ACTIONS.STATUS,
                ACTIONS.COMMIT_PUSH,
                ACTIONS.PULL,
                ACTIONS.PUSH,
                ACTIONS.BRANCH_MANAGE,
                ACTIONS.MERGE,
                ACTIONS.REMOTE_MANAGE,
                ACTIONS.EXIT
            ]
        }
    ]);

    return action;
}

/**
 * 执行操作
 */
async function executeAction(action) {
    switch (action) {
        case ACTIONS.STATUS:
            await showStatus();
            break;
        case ACTIONS.COMMIT_PUSH:
            await commitAndPush();
            break;
        case ACTIONS.PULL:
            await pullCode();
            break;
        case ACTIONS.PUSH:
            await pushCode();
            break;
        case ACTIONS.BRANCH_MANAGE:
            await manageBranches();
            break;
        case ACTIONS.MERGE:
            await mergeBranch();
            break;
        case ACTIONS.REMOTE_MANAGE:
            await manageRemotes();
            break;
        case ACTIONS.EXIT:
            console.log(chalk.blue("👋 退出 myGit"));
            process.exit(0);
    }
}

/**
 * 等待用户按回车继续
 */
async function waitForContinue() {
    await inquirer.prompt([
        {
            type: "input",
            name: "continue",
            message: chalk.gray("按回车键继续..."),
        }
    ]);
}

/**
 * 主函数
 */
async function main() {
    await checkIsRepo();

    // 循环显示菜单，直到用户选择退出
    while (true) {
        try {
            const action = await showMainMenu();
            await executeAction(action);
            
            // 如果不是退出操作，等待用户按回车继续
            if (action !== ACTIONS.EXIT) {
                await waitForContinue();
                console.log(); // 添加空行分隔
            }
        } catch (err) {
            if (err.isTtyError) {
                console.log(chalk.red("❌ 当前环境不支持交互式操作"));
                process.exit(1);
            } else {
                handleError(err, "执行操作");
                // 出错后也等待用户继续
                try {
                    await waitForContinue();
                } catch (waitErr) {
                    // 如果等待失败，继续循环
                }
            }
        }
    }
}

// 运行主函数
main().catch(err => {
    console.error(chalk.red("❌ 发生未预期的错误:"), err);
    process.exit(1);
});
