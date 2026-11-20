---
title: "做一个 MCP 服务：同一份课程数据，给网页和 Agent 使用"
date: "2026-11-20"
summary: "建立同时提供 REST 与 MCP 的本机只读服务。"
series: "Agent Framework 进阶"
order: 28
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["agent-function-tools"]
goals: ["建立同时提供 REST 与 MCP 的本机只读服务。"]
---

你已经写过一个查询课程时长的函数。网页可能希望通过 HTTP 接口调用它，Agent 则希望知道有哪些工具、需要什么参数。MCP 为工具发现和调用提供协议，REST 则继续服务普通业务客户端。它们可以共享业务逻辑，不需要把整个 Web API 推翻重写。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。此练习不需要模型和 API Key。在 ai-course 目录运行 dotnet run --project McpServer，终端保持开启。服务只监听本机 localhost:5071。



## 代码是怎样工作的

HTTP 分支注册 AddMcpServer、WithHttpTransport 和 CourseTools，然后 MapMcp("/mcp") 提供协议端点。普通 /courses/{name} 路由调用同一个方法。工具上的描述告诉客户端用途，参数描述说明课程名称。源码中的 --stdio 和 --agent 是后续专题选项，本篇不用打开。

```csharp
using System.ComponentModel;
using ModelContextProtocol.Server;
using AiCourse;
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;

if (args.Contains("--stdio"))
{
    var builder = Host.CreateApplicationBuilder();
    builder.Logging.ClearProviders();
    builder.Logging.AddConsole(options => options.LogToStandardErrorThreshold = LogLevel.Trace);
    var mcp = builder.Services.AddMcpServer().WithStdioServerTransport().WithTools<CourseTools>();
    if (args.Contains("--agent")) mcp.WithTools<AgentTools>();
    await builder.Build().RunAsync();
}
else
{
    var builder = WebApplication.CreateBuilder(args.Where(arg => arg != "--agent").ToArray());
    builder.WebHost.UseUrls("http://localhost:5071");
    var mcp = builder.Services.AddMcpServer().WithHttpTransport().WithTools<CourseTools>();
    if (args.Contains("--agent")) mcp.WithTools<AgentTools>();
    var app = builder.Build();
    app.MapGet("/courses/{name}", (string name) => CourseTools.FindCourse(name));
    app.MapMcp("/mcp");
    await app.RunAsync();
}

[McpServerToolType]
public sealed class CourseTools
{
    [McpServerTool, Description("查询演示课程学习时长，只读。支持AI入门和C#起步。")]
    public static string FindCourse([Description("课程名")] string name) => name switch
    { "AI入门" => "30分钟", "C#起步" => "45分钟", _ => "未找到课程" };
}

[McpServerToolType]
public sealed class AgentTools
{
    [McpServerTool, Description("请教学助手用中文解释一个AI概念。会调用模型。")]
    public static async Task<string> Explain([Description("要学习的AI概念，最多200字")] string topic, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(topic) || topic.Length > 200) throw new ArgumentException("主题应为1到200字。");
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(45));
        using var client = CourseClient.Create();
        var agent = client.AsAIAgent(instructions: "只解释AI学习相关主题，用三句话说明，不执行外部操作。");
        return (await agent.RunAsync(topic, cancellationToken: timeout.Token)).ToString();
    }
}

```



## 怎样判断成功

另开终端访问 `http://localhost:5071/courses/AI入门`，应得到30分钟。REST 成功只说明业务服务在线，不能证明 MCP 握手完成；下一篇会用 MCP 客户端列出工具并直接调用验证。浏览器打开 /mcp 看到错误，也不一定表示服务坏了，因为协议请求有规定的消息与请求头。

## 自己改一次

给 CourseTools 增加一门课程，重新启动服务，同时从 REST 与 MCP 客户端查询。检查两条路径是否返回相同结果。这能帮助你理解协议层只是适配器，业务规则应该共享，而不是各复制一份。

## 遇到问题先看这里

端口占用时先停止自己的旧实验进程。服务只在本机演示，没有实现公网认证、授权和限流；部署前应按真实身份与资源范围设计这些能力。不要直接把数据库管理方法全部标成工具。

## 参考资料

- [MCP 官方文档](https://modelcontextprotocol.io/docs/getting-started/intro)
- [C# MCP SDK](https://github.com/modelcontextprotocol/csharp-sdk)
