# 项目管理平台自动化注册指南 (AI 助手专用)

**目标读者**: 负责生成新项目的 AI 助手、脚手架工具、DevOps 脚本。

本文档是**项目端口管理系统**的标准接入协议。所有新创建的项目，必须遵循本协议完成自动化注册，以便被统一管理。

---

## 1. 核心流程 (SOP)

当您（AI 助手）完成了一个新项目的代码生成后，请执行以下 **3 步操作**：

1.  **生成配置文件**：在项目的根目录下生成一个 `project_config.json` 文件。
2.  **执行注册脚本**：调用管理平台的标准 Python 脚本进行注册。
3.  **验证结果**：检查脚本的退出代码（Exit Code 0 表示成功）。

---

## 2. 详细操作步骤

### 第一步：生成配置文件 (`project_config.json`)

请在您的新项目根目录下，创建一个 JSON 文件，内容必须符合以下 Schema。

**文件路径示例**: `D:\Projects\NewApp\project_config.json`

**JSON 模板**:

```json
{
  "id": "unique-project-id-2026",      // [必填] 全局唯一ID，建议包含日期或随机串
  "name": "My New Project",            // [必填] 项目显示名称
  "root_path": "D:\\Projects\\NewApp", // [必填] 项目根目录绝对路径 (注意 JSON 转义)
  "frontend_url": "http://127.0.0.1:3000", // [可选] 前端访问地址
  "services": [                        // [必填] 服务列表
    {
      "id": "newapp-backend",          // [必填] 服务唯一ID
      "name": "Backend API",           // [必填] 服务名称
      "type": "backend",               // [必填] 类型: backend / frontend / other
      "cwd": "D:\\Projects\\NewApp\\backend", // [必填] 启动命令的工作目录
      "command": "python main.py",     // [必填] 启动命令 (Windows 兼容)
      "ports": [8000]                  // [必填] 占用的端口列表
    },
    {
      "id": "newapp-frontend",
      "name": "Web UI",
      "type": "frontend",
      "cwd": "D:\\Projects\\NewApp\\frontend",
      "command": "npm run dev",
      "ports": [3000]
    }
  ]
}
```

> **注意**: Windows 路径中的反斜杠 `\` 需要在 JSON 中转义为 `\\`。

### 第二步：执行注册脚本

管理平台提供了一个幂等的注册脚本，位于：
`D:\Docs\03AI\01Trae\project-port-manager\register_project.py`

请在您的代码或终端中执行：

```bash
python "D:\Docs\03AI\01Trae\project-port-manager\register_project.py" "D:\Projects\NewApp\project_config.json"
```

### 第三步：验证

- **Exit Code 0**: 注册成功（无论是通过 API 还是文件写入）。
- **Exit Code 1**: 注册失败（请检查 JSON 格式或路径是否存在）。

---

## 3. 最佳实践 (Best Practices)

1.  **端口分配策略**:
    - 在生成配置前，请先扫描端口占用情况。
    - 建议为新项目分配不常用的端口段（如 8000-8099, 3000-3099）。

2.  **启动命令**:
    - 前端推荐使用 `npm run dev` 或 `yarn dev`。
    - 后端推荐使用 `venv` 中的解释器路径，例如:
      `".\\venv\\Scripts\\python.exe main.py"`
      或者确保全局环境中有依赖。

3.  **ID 命名规范**:
    - 项目 ID: `{项目名}-{日期}-{随机后缀}` (例: `stock-analysis-20240215`)
    - 服务 ID: `{项目ID}-{服务类型}` (例: `stock-analysis-backend`)

---

## 4. 常见问题排查

- **Q: 注册后管理界面没有显示？**
  - A: 请检查 `config.json` 是否包含您的新条目。如果是手动修改文件，请确保 JSON 语法正确。

- **Q: 服务启动失败？**
  - A: 请手动进入 `cwd` 目录，尝试运行 `command`，查看报错信息。通常是依赖未安装或路径错误。

- **Q: 脚本报错 `ModuleNotFoundError`？**
  - A: 注册脚本仅依赖 Python 标准库 (`json`, `urllib`, `sys`, `pathlib`)，无需额外 pip 安装。请确保使用标准 Python 3.x 环境。
