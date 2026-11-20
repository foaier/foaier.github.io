---
title: 用 C# 写第一个 Agent：先让它完成一件小事
date: 2026-11-20
summary: 从 Microsoft Agent Framework 的最小调用开始，分清模型客户端、Agent 与 Session，再逐步加上业务能力。
series: Agent 开发
order: 1
tags: [Agent Framework, C#, 入门]
---

第一个 Agent 不必同时具备联网、记忆、计划和自动操作。先让它把一段散乱的问题整理成工单摘要，就已经能跑通最重要的调用链路。

这一篇使用 Microsoft Agent Framework 的 C# 接口。示例基于本文整理时的官方文档，云端调用需要你自己的资源、权限和配额。

## Agent 比一次模型调用多了什么

模型客户端负责和推理服务通信；Agent 在这上面组织指令、工具、会话和运行过程。一个 Agent 可以很简单，也可以运行多轮工具调用。

`AIAgent` 是框架中的统一抽象。`ChatClientAgent` 是常见的应用自管实现，背后连接模型客户端。服务托管 Agent、自定义 `AIAgent` 实现，又属于不同的接入方式，不能只看变量类型就认定执行位置相同。

先使用现成实现，只有当标准生命周期确实无法满足需求时，再考虑继承基类自己实现运行逻辑。

## 准备最小环境

准备 .NET 10 SDK、Azure CLI、一个 Foundry 项目和已部署的模型。登录的开发者身份需要有相应调用权限。

```bash
dotnet new console -n FirstAgent --framework net10.0
cd FirstAgent
dotnet add package Microsoft.Agents.AI.Foundry --version 1.28.0-preview.261106.1
dotnet add package Azure.Identity --version 1.21.0
az login
```

这里锁定了 Foundry 集成包的预览版本，并以 `net10.0` 为目标完成编译检查；这不表示框架所有包都处于相同发布阶段。不要把不同日期的预览示例随意混用，云端行为仍需在自己的资源上验证。

设置 `FOUNDRY_PROJECT_ENDPOINT` 为项目终结点，`FOUNDRY_MODEL_DEPLOYMENT` 为部署名。项目地址通常包含 `/api/projects/`，请直接从自己的项目获取。

## 写出第一次调用

将 `Program.cs` 替换为下面内容，再运行 `dotnet run`：

```csharp
using Azure.AI.Projects;
using Azure.Identity;
using Microsoft.Agents.AI;

var endpoint = Environment.GetEnvironmentVariable("FOUNDRY_PROJECT_ENDPOINT")
    ?? throw new InvalidOperationException("缺少项目终结点");
var deployment = Environment.GetEnvironmentVariable("FOUNDRY_MODEL_DEPLOYMENT")
    ?? throw new InvalidOperationException("缺少模型部署名");

var project = new AIProjectClient(new Uri(endpoint), new AzureCliCredential());
AIAgent agent = project.AsAIAgent(
    model: deployment,
    name: "TicketSummary",
    instructions: "把问题整理为简短工单摘要。只保留已知事实，不补充处理结果。");

var response = await agent.RunAsync(
    "我今天上午提交了退款申请，页面一直显示审核中，想问一下该怎么办。");
Console.WriteLine(response);
```

这个例子只生成摘要，不会去查询退款系统。因此它不应该声称“退款已到账”或者“已帮你催办”。这就是第一条验收标准：不要把文字生成误当成业务执行。

`AzureCliCredential` 适合这里明确使用 CLI 登录态的本地示例。部署时要使用与环境匹配的身份方式，而不是让服务器依赖某个开发者电脑上的登录状态。

## 流式输出只是显示方式变了

将普通调用替换为下面的片段，可以逐步显示响应：

```csharp
await foreach (var update in agent.RunStreamingAsync(
    "请用两句话解释：退款审核中不等于退款已经完成。"))
{
    Console.Write(update);
}
```

流式输出让用户更早看到文字，但它不会自动让后台任务可恢复，也不意味着每个片段都是最终结构化结果。连接中断后怎样显示状态、是否允许重试，需要应用继续处理。

## 下一步加什么，按需求决定

需要多轮对话，就加 Session；需要实时业务信息，就加只读工具；需要固定字段，就加结构化输出；需要跨步骤可靠执行，再考虑工作流。

别一次把所有功能都打开。每增加一层，留下一条能验证它的样例：工具确实被调用了、会话没有串到别人、输出格式能被程序解析。这样出了问题，也能知道该往哪一层找。

## 参考资料

- [Agent Framework：第一个 Agent](https://learn.microsoft.com/en-us/agent-framework/get-started/your-first-agent)
- [Agent Framework 概览](https://learn.microsoft.com/en-us/agent-framework/overview/)
- [Foundry 模型与托管 Agent 的区别](https://learn.microsoft.com/en-us/agent-framework/integrations/by-component/agent-services/foundry)
