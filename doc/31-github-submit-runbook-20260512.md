# GitHub 提交与推送经验记录（2026-05-12）

## 1. 本地文档查阅结论

本轮提交前，已查阅当前项目与相邻本地项目中的 GitHub 相关记录。

当前项目内已有线索：

- `doc/10-glm5-game-specs-index.md` 记录当前仓库为 `https://github.com/barbecuenfg-Charong/cognitive-training`。
- `doc/22-training-effect-alignment-and-module-optimization-20260511.md` 明确当前仓库、Pages 和文档入口，要求文档不要再指向旧 GitHub 空间。
- `doc/28-practical-training-loop-and-planning-report-20260511.md` 记录“在稳定网络窗口统一提交并推送 GitHub”。

但当前项目内此前没有一份完整的“提交成功经验 / 故障转移步骤”文档。

相邻项目中可复用的经验：

- `../20260306work001/scripts/create-github-repo.js` 使用 `git credential fill` 从 Git Credential Manager 获取本机已保存的 GitHub 凭据。
- 同一脚本通过 `api.github.com` 调用 GitHub REST API，而不是只依赖 `git push` 传输层。

这说明本机过去的有效思路是：优先走正常 Git；当 Git 传输层被网络阻断时，检查 Git Credential Manager 和 GitHub API 是否仍可用。

## 2. 当前仓库口径

- 本地路径：`D:\Docs\03AI\02TraeCN\20260304work001`
- 远端：`https://github.com/barbecuenfg-Charong/cognitive-training.git`
- 分支：`main`
- Pages：`https://barbecuenfg-charong.github.io/cognitive-training/`

提交前必须先确认当前仓库不是相邻的 A 股 K 线项目。

## 3. 推荐提交流程

常规网络可用时：

```powershell
git status --short --branch
npm run check
npm run smoke:pages
git diff --check
git add -A
git commit -m "feat: ..."
git push origin main
```

本项目当前门禁要点：

- `npm run check` 已包含语法检查、敏感路径检查、Font Awesome 加载检查、流程 smoke 和 picky-player 高风险门禁。
- `npm run smoke:pages` 单独覆盖静态页面引用。
- `git diff --check` 在 Windows 上可能出现 LF/CRLF 提示，这不是实质格式错误。

## 4. 网络失败时的判断顺序

如果 `git push origin main` 报：

```text
Failed to connect to github.com port 443
```

不要先判断为认证错误。应区分三层：

1. `github.com:443` 是否能建立 TCP。
2. `api.github.com:443` 是否可用。
3. `ssh.github.com:443` 是否可用。

可用检查：

```powershell
Test-NetConnection github.com -Port 443
Test-NetConnection api.github.com -Port 443
Test-NetConnection ssh.github.com -Port 443
git ls-remote origin -h refs/heads/main
```

本轮观察到的状态：

- `github.com:443` TCP 失败，导致普通 HTTPS `git push` 失败。
- `api.github.com:443` 可用。
- `ssh.github.com:443` 可用，但本机 SSH key 未被 GitHub 接受，`ssh -T` 返回 `Permission denied (publickey)`。
- Git Credential Manager 能返回当前 GitHub 仓库访问凭据。

因此本轮备用路径应优先考虑 GitHub API，而不是反复重试普通 `git push`。

## 5. 备用路径原则

当普通 push 不通，但 `api.github.com` 可用时，可以使用 GitHub Git Database API 完成等效推送：

1. 读取远端 `heads/main` 当前 SHA。
2. 用远端当前 tree 作为 base tree。
3. 将本地 `origin/main..HEAD` 的新增/修改文件创建 blob。
4. 用这些 blob 创建新 tree。
5. 创建 parent 为远端 main 的 commit。
6. 更新 `refs/heads/main` 到新 commit。

注意事项：

- 不在日志或文档中写入 token。
- API 写入前必须确认远端 main 仍等于本地 `origin/main`，避免覆盖别人刚推送的提交。
- 如果远端 main 已前进，应先重新同步并处理冲突。
- 若普通 `git fetch` 也因网络失败，可用 GitHub API 读取远端 ref 做最小确认。

## 6. 本轮提交状态

本轮本地提交已生成：

```text
feat: strengthen adaptive cognitive training loops
```

本轮目标是把训练本体增强、流程门禁、报告展示、每日计划和文档一起同步到 GitHub。若普通 push 继续失败，应按第 5 节使用 API 备用路径。
