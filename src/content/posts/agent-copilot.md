---
title: "接入 GitHub Copilot SDK：先完成一次受限的问答"
date: "2026-11-20"
summary: "通过 CopilotClient 创建 Agent，并理解权限开放与普通聊天的区别。"
series: "Agent Framework 进阶"
order: 10
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["first-agent"]
goals: ["通过 CopilotClient 创建 Agent，并理解权限开放与普通聊天的区别。"]
---

Copilot SDK 可以把 Copilot 的能力接进程序，但“接入成功”不应一开始就等于允许模型操作整个电脑。我们先做最小问答，让你看清客户端启动、会话和返回值。需要文件或命令能力时，再按实际任务逐项设计权限。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。需要可用的 GitHub Copilot 权限和 Copilot CLI 登录状态。先安装并运行 copilot 完成登录，确认本机 CLI 能正常聊天；本例不使用 AI_API_KEY。

~~~powershell
dotnet run --project Integrations -- copilot
~~~

## 代码是怎样工作的

创建 CopilotClient，StartAsync 启动客户端，再通过 AsAIAgent 获得统一 Agent 接口。示例没有提供自动批准文件、Shell 或 URL 的处理器，只要求解释概念。默认拒绝敏感权限是 SDK 的行为，提示词里的“不执行命令”只是意图说明，不能替代权限机制。

```csharp
public static async Task Copilot()
    {
        await using var client = new CopilotClient();
        await client.StartAsync();
        // 默认不开放文件、Shell和URL权限；本练习只进行问答。
        var agent = client.AsAIAgent(sessionConfig: null);
        Console.WriteLine(await agent.RunAsync("用中文解释Agent Framework，不读取文件，不执行命令。"));
    }
```



## 怎样判断成功

应返回一段中文说明，且没有文件修改或命令执行。首次还原可能下载 Copilot 运行组件，网络耗时与模型调用是两件事。包可以编译不代表账号拥有服务权限，需要在你自己的登录环境做实际调用验证。

## 自己改一次

先在 CLI 中确认登录，再用课程命令运行相同问题。若后续要做代码助手，列出确实需要的只读目录与操作，设计单独的批准处理。不要为了消除报错就把所有权限请求统一返回允许。

## 遇到问题先看这里

启动失败先检查 CLI 和运行组件是否可用；认证错误检查 GitHub 登录与订阅。不要把 GitHub Personal Access Token 想当然地当作普通 OpenAI Key。后台部署还要明确认证方式、运行用户和工作目录，不依赖开发机里偶然存在的会话。

## 参考资料

- [Copilot 集成](https://learn.microsoft.com/en-us/agent-framework/integrations/by-component/agent-services/github-copilot)
- [Copilot SDK](https://github.com/github/copilot-sdk)
