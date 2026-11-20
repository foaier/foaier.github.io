---
title: MCP 怎么接进现有 Web API？先从一个只读工具开始
date: 2026-11-20
summary: 分清 MCP Host、Client、Server，以及 stdio 和 HTTP；再用 ASP.NET Core 暴露一个小工具。
series: Agent 开发
order: 5
tags: [MCP, ASP.NET Core, OpenAPI]
---

你已经有一个查工单的 Web API，想让多个 AI 应用都能调用。可以分别写适配，也可以在业务能力外面加一层 MCP 接口。

MCP 的价值是统一能力发现和调用约定。它不会自动把普通接口变得安全，也不会替你决定哪些用户有权查哪些工单。

## 三个角色，别都叫 Server

Host 是用户正在使用的 AI 应用；Client 是 Host 内与某个 MCP Server 通信的部分；Server 对外提供工具、资源或提示模板等能力。

Server 不一定需要自己调用模型。一个提供只读工单查询的 MCP 服务，可以完全由普通业务代码组成。

反过来，也可以把一个 Agent 封装成工具：外部调用者传入任务，内部 Agent 完成处理，再返回结果。此时要明确它的成本、超时、会话归属与可执行动作，不能把整个 Agent 无边界地开放出去。

## stdio 和 HTTP 的使用场景不同

stdio 常用于本机集成：宿主启动一个子进程，通过标准输入输出交换协议消息。**普通日志不要混进 stdout**，否则可能破坏协议；按 SDK 方式把日志送到 stderr 等独立通道。

HTTP 更适合远程服务。当前常见的是 Streamable HTTP；老教程中的独立 SSE 传输方式，需要按客户端和服务端版本核对。它们不能只换一个 URL 就当作等价。

协议和 SDK 都在演进，尤其初始化、会话和扩展能力的行为可能随版本变化。优先让 SDK 处理协议细节，而不是手工拼几条 JSON-RPC 消息假装完成集成。

## 一个 ASP.NET Core 最小示例

使用 .NET 10，在独立实验项目中安装官方 MCP SDK 的 ASP.NET Core 包：

```bash
dotnet new web -n TicketMcp --framework net10.0
cd TicketMcp
dotnet add package ModelContextProtocol.AspNetCore --version 2.4.0
```

将 `Program.cs` 改成下面内容。示例按 `ModelContextProtocol.AspNetCore 2.4.0`、`net10.0` 完成编译检查。这是本地只读演示，没有接实际业务，也没有配置远程鉴权。

```csharp
using System.ComponentModel;
using ModelContextProtocol.Server;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddMcpServer()
    .WithHttpTransport()
    .WithTools<TicketTools>();

var app = builder.Build();
app.MapMcp("/mcp");
app.Run();

[McpServerToolType]
public sealed class TicketTools
{
    [McpServerTool, Description("查询演示工单状态，只读操作。")]
    public static string GetStatus(
        [Description("演示工单编号，例如 DEMO-001")] string ticketId)
        => ticketId == "DEMO-001" ? "演示状态：处理中" : "未找到演示工单";
}
```

运行 `dotnet run --urls http://127.0.0.1:5058`。用支持 HTTP MCP 的客户端或 Inspector 连接 `/mcp`，先查看工具列表，再调用 `GetStatus`。浏览器直接访问返回的页面，不是判断协议是否工作完整的办法。

## 接现有业务时，共享服务层

已有 Web API 和 MCP 工具最好调用同一套应用服务，这样校验、鉴权和状态处理只维护一份。没必要让 MCP 工具再用 HTTP 绕回来调用同一进程里的 Controller。

开放给远程调用者之前，补上身份认证、工具授权、限流、参数验证和日志。工具发现成功，不代表调用者自动拥有所有工具的权限。

如果使用 OpenAPI 自动生成或接入工具，也要筛选接口。API 说明里有删除、批处理或管理能力，不等于它们都适合直接暴露给模型。

## GitHub MCP 和 Agent 封装也是同一原则

接入 GitHub MCP 时，根据任务只提供需要的仓库与操作范围，并使用合适的凭证。读取 issue 与创建提交的影响不同，不能因为是同一个 Server 就一律放开。

把 Agent 暴露为 MCP 工具时，当前不同语言 SDK 的官方封装支持并不完全一致。.NET 可以按 MCP SDK 工具处理器调用业务或 Agent 服务，不要假定所有语言都存在同名的一行封装方法。

## 验证四个结果

检查工具能被发现、正常参数能返回、不合法参数能明确拒绝、越权请求在业务层被拦截。再观察超时、取消和进程退出后资源是否释放。

MCP 让连接方式统一，工具的质量仍然取决于你暴露的是怎样一项业务能力。

## 参考资料

- [MCP 架构说明](https://modelcontextprotocol.io/docs/learn/architecture)
- [官方 C# SDK 与包划分](https://github.com/modelcontextprotocol/csharp-sdk)
- [Agent Framework：MCP 客户端工具](https://learn.microsoft.com/en-us/agent-framework/agents/tools/local-mcp-tools)
- [把 Agent 暴露为 MCP 工具的语言支持说明](https://learn.microsoft.com/en-us/agent-framework/hosting/self-hosting/mcp)
