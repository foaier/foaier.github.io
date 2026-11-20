# 从零学习 AI · C# 示例

配套路线：[从零学 AI](https://foaier.github.io/learn/)。下载包和仓库使用同一份源代码，包中不包含密钥、构建产物或模型运行组件。

## 第一次运行

安装 .NET 10 SDK，解压后在 **ai-course** 目录打开终端：

```powershell
dotnet --version
dotnet run --project Core -- check
```

`global.json` 允许稳定的 .NET 10 SDK 功能版本升级，不选预览 SDK。第一次还原需要网络。接下来编译其他项目：

```powershell
dotnet build Integrations
dotnet build Workflows
dotnet build McpServer
dotnet run --project Integrations -- check-mcp
```

`check` 验证本地检索、会话序列化和技能构造；`check-mcp` 真正启动本地工具进程，完成握手、发现与查询，并检查余弦计算。二者均不调用在线模型。

## 配置模型

PowerShell（只在当前终端有效）：

```powershell
$env:AI_ENDPOINT = "https://你的服务基础地址/v1"
$env:AI_MODEL = "你的聊天模型名称"
$env:AI_API_KEY = Read-Host "输入模型 API Key" -MaskInput
dotnet run --project Core -- chat
```

`-MaskInput` 需要 PowerShell 7。其他 Shell 可用其安全输入方式设置环境变量，避免把真实密钥提交到仓库或粘贴进截图。不要把上面的占位地址原样使用。

Bash 可使用 `export AI_ENDPOINT='…'`、`export AI_MODEL='…'`，再通过 `read -rs AI_API_KEY; export AI_API_KEY` 读取密钥。程序不会自动加载 `.env` 文件。

## 练习命令

所有命令都在 ai-course 根目录运行。运行某个项目但不带命令，会打印可用命令列表。

| 项目 | 命令 | 需要什么 |
| --- | --- | --- |
| Core | chat、agent、stream、session、save | 普通模型连接 |
| Core | tools、approval、structured | 工具调用或结构化输出支持 |
| Core | file-memory、reduce | 模型连接；文件记忆写入 `.state` |
| Core | skill-file、skill-inline、skill-class、skill-combine、skill-di | 支持工具调用的模型 |
| Core | di、middleware、plugin、telemetry、nested-agent、plan | 普通模型或工具能力 |
| Core | vision | 图片模型；`AI_IMAGE_FILE` 指向 PNG/JPEG |
| Core | project | 结构化输出模型；交互输入问题 |
| Integrations | embedding | `AI_EMBEDDING_MODEL` 与兼容向量服务 |
| Integrations | history-memory | 同上，另设 `AI_EMBEDDING_DIMENSIONS` |
| Integrations | valkey | 本机 Valkey 或 `VALKEY_CONNECTION` |
| Integrations | responses、background | 支持 Responses / 后台响应的服务 |
| Integrations | foundry、foundry-create、foundry-existing | Foundry 配置，见下文 |
| Integrations | foundry-memory | 另设已有 `FOUNDRY_MEMORY_STORE` |
| Integrations | declarative、harness | 模型连接 |
| Integrations | copilot | Copilot CLI 登录与服务权限 |
| Integrations | mcp-http | 已启动 McpServer；可改 `MCP_ENDPOINT` |
| Integrations | mcp-stdio | 先编译 McpServer，由客户端启动 |
| Integrations | a2a、a2a-tool | 可信 `A2A_ENDPOINT`；工具模式还需本地模型 |
| Integrations | code-interpreter、web-search | Foundry 与对应工具支持 |
| Integrations | file-search | 另设已有 `FOUNDRY_VECTOR_STORE_ID` |
| Integrations | openapi | `OPENAPI_SPEC_FILE`；API 必须云端可达 |
| Integrations | mem0-add、mem0-search | `MEM0_API_KEY`；搜索回答还需模型 |
| Workflows | branch、switch、fanout、loop、composition | 不需要模型 |
| Workflows | human、checkpoint、rollback、resume-human、diagram | 不需要模型；human 需要终端输入 |
| Workflows | agent-node、mixed、sequential、concurrent、handoff、group、improve | 模型连接，部分模式需要工具调用 |
| Workflows | multi-model | 另设 `SECOND_AI_ENDPOINT`、`SECOND_AI_MODEL`、`SECOND_AI_API_KEY` |

示例：`dotnet run --project Workflows -- branch`。Workflows 不带参数运行基础流程。

## Foundry 与 MCP

Foundry 需要 `az login`，以及 `FOUNDRY_PROJECT_ENDPOINT`、`FOUNDRY_MODEL_DEPLOYMENT`。管理具名 Agent 时另设 `FOUNDRY_AGENT_NAME`。创建会要求输入 `create`，运行一次可能创建新版本并产生费用。示例不自动创建 Memory Store、向量索引或删除云资源。

MCP 服务：`dotnet run --project McpServer`，只监听本机 `http://localhost:5071`。REST 路径 `/courses/{name}`，MCP 路径 `/mcp`。加 `-- --agent` 才注册会调用模型的 Explain 工具；加 `-- --stdio` 使用标准输入输出。普通查询不需要密钥。

Mem0 使用 v3 REST 接口。新增返回的 event_id 需通过官方 `GET /v1/event/{event_id}/` 查询，状态为 SUCCEEDED 后再搜索。不要反复新增代替等待任务完成。使用演示用户 `foaier-course-demo`，测试后在控制台清理。

## 版本与验证边界

核心 Agent Framework / Workflows 固定 1.28.0，OpenAI 2.14.0，Microsoft.Extensions.AI.OpenAI 10.11.0，MCP 2.4.0。Foundry、A2A、Valkey、声明式与内存向量连接器含预览版本，以各 `.csproj` 为准。少数 API 带实验诊断，源码只在相应位置局部处理，没有全局关闭警告。

所有项目会由 CI 编译。离线检查与确定性工作流可在没有密钥时运行。在线模型、云端工具、Copilot、Valkey、A2A 与 Mem0 需要你的服务环境；编译通过不表示这些服务已经替你验收。回答文本不保证逐字一致。

工作流检查点示例使用内存 CheckpointManager，演示同一进程中的恢复；没有声称支持应用重启后的恢复。知识助手是关键词检索基线；真实向量调用见 embedding，向量历史演示使用内存库。MCP 本机服务未实现公网身份、限流等部署能力。

运行产生的文件放在 `.state`。只在确认不需要自己的实验数据后清理该目录。不要把真实用户资料放进共享演示范围。
