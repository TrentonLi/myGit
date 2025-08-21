#!/usr/bin/env node
const inquirer = require("inquirer");
const chalk = require("chalk");
const simpleGit = require("simple-git");
const git = simpleGit();

async function main() {
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
        console.log(chalk.red("❌ 当前目录不是一个 Git 仓库"));
        process.exit(1);
    }

    const branchSummary = await git.branch();
    const currentBranch = branchSummary.current;

    console.log(chalk.blue(`📂 当前分支: ${currentBranch}`));

    const { action } = await inquirer.prompt([
        {
            type: "list",
            name: "action",
            message: "请选择要执行的操作",
            choices: [
                "查看状态 (git status)",
                "提交代码 (add. && commit && pull && push)",
                "拉取代码 (git pull)",
                "推送代码 (git push)",
                "分支管理 (查看/切换分支)",
                "合并分支",
                "退出"
            ]
        }
    ]);

    switch (action) {
        case "查看状态 (git status)": {
            const status = await git.status();
            console.log(chalk.green(`📂 当前分支: ${status.current}`));
            console.log(chalk.blue(`🔗 跟踪分支: ${status.tracking || "无"}`));
            console.log(chalk.yellow(`📌 提交领先: ${status.ahead}, 落后: ${status.behind}`));

            if (status.modified.length > 0) {
                console.log(chalk.red("✏️ 已修改文件:"), status.modified);
            } else {
                console.log(chalk.green("✅ 没有修改文件"));
            }
            break;
        }

        case "提交代码 (add. && commit && pull && push)": {
            const { msg } = await inquirer.prompt([
                { type: "input", name: "msg", message: "请输入提交信息:" }
            ]);
            await git.add(".");
            await git.commit(msg);
            console.log(chalk.green("✅ 提交成功"));

            // 拉取远程更新，避免冲突
            try {
                const pullResult = await git.pull();
                console.log(chalk.blue("⬇️ 已同步远程最新代码"));
                if (pullResult.summary.changes || pullResult.summary.insertions || pullResult.summary.deletions) {
                    console.log(chalk.yellow("📌 本地有变更已合并: "), pullResult.summary);
                }
            } catch (err) {
                console.log(chalk.red("❌ 拉取失败:"), err.message);
                break; // 拉取失败就不推送，避免错乱
            }

            // 自动推送
            try {
                const remotes = await git.getRemotes(true);
                const remote = remotes.find(r => r.name === "origin")?.name || remotes[0]?.name;
                await git.push(remote, currentBranch);
                console.log(chalk.green(`🚀 已自动推送到 ${remote}/${currentBranch}`));
            } catch (err) {
                console.log(chalk.red("❌ 推送失败:"), err.message);
            }
            break;
        }

        case "拉取代码 (git pull)": {
            try {
                const result = await git.pull();
                console.log(chalk.green("⬇️ 拉取完成"));
                console.log(result.summary);
            } catch (err) {
                console.log(chalk.red("❌ 拉取失败:"), err.message);
            }
            break;
        }

        case "推送代码 (git push)": {
            const remotes = await git.getRemotes(true);
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
            await git.push(remote, branch);
            console.log(chalk.green("🚀 推送完成"));
            break;
        }

        case "分支管理 (查看/切换分支)": {
            const branches = await git.branchLocal();
            const { branch } = await inquirer.prompt([
                {
                    type: "list",
                    name: "branch",
                    message: "选择要切换的分支:",
                    choices: branches.all,
                    default: branches.current
                }
            ]);
            await git.checkout(branch);
            console.log(chalk.green(`✅ 已切换到分支: ${branch}`));
            break;
        }

        case "合并分支": {
            const branches = await git.branchLocal();
            const { branch } = await inquirer.prompt([
                {
                    type: "list",
                    name: "branch",
                    message: "选择要合并的分支:",
                    choices: branches.all.filter(b => b !== currentBranch)
                }
            ]);
            try {
                await git.merge([branch]);
                console.log(chalk.green(`✅ 已合并分支 ${branch} 到 ${currentBranch}`));
            } catch (err) {
                console.log(chalk.red("❌ 合并失败:"), err.message);
            }
            break;
        }

        case "退出":
            console.log("👋 退出 myGit");
            process.exit(0);
    }
}

main().then(r => {});