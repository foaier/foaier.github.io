---
title: "MCP STDIO：让客户端启动一个本地工具进程"
date: "2026-11-20"
summary: "用标准输入输出连接本地 MCP 服务，理解进程和日志的边界。"
series: "Agent Framework 进阶"
order: 30
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["agent-mcp-http"]
goals: ["用标准输入输出连接本地 MCP 服务，理解进程和日志的边界。"]
---

本地工具不一定要监听端口。STDIO 模式让客户端启动工具程序，双方通过标准输入输出交换协议消息。对使用者像调用一个工具，对操作系统则是真实启动了子进程，因此命令、参数和工作目录都要清楚。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。请在当前终端配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY，并选择支持工具调用的模型。这里提供的是可编译示例；真实回答取决于模型服务，文字不会每次相同。 先执行 dotnet build McpServer。本篇必须在 ai-course 根目录运行，客户端将启动该目录下的 McpServer 子进程。

~~~powershell
dotnet run --project Integrations -- mcp-stdio
~~~

## 代码是怎样工作的

StdioClientTransport 的 Command 是 dotnet，Arguments 是参数数组，不拼成一段 Shell 命令。子进程以 --stdio 启动，服务端用 WithStdioServerTransport。日志写到标准错误，标准输出留给协议；随手加一句 Console.WriteLine 调试信息，可能破坏消息解析。

```csharp
public static async Task McpStdio()
    {
        // 在ai-course根目录运行；由客户端启动并管理本地只读工具服务。
        await using var client = await McpClient.CreateAsync(new StdioClientTransport(new()
        { Name = "CourseTools", Command = "dotnet", Arguments = ["run", "--no-build", "--project", "McpServer", "--", "--stdio"] }));
        await AskMcp(client);
    }
```



## 怎样判断成功

应先发现课程工具，再完成查询。控制台可能同时显示子进程日志，这是标准错误输出，不是协议正文。客户端退出时应释放连接并管理子进程，不应不断留下后台 dotnet 实例。

## 自己改一次

把工作目录切到其他目录运行，观察为什么相对项目路径找不到。再回到根目录验证。理解后可以把项目路径改成应用计算出的绝对路径，但不要让用户问题决定要启动什么命令或注入任意参数。

## 遇到问题先看这里

找不到程序集时先编译 McpServer，因为客户端用了 --no-build。协议解析失败时检查标准输出是否混入日志。第一次启动耗时不一定是模型延迟，也可能是进程加载。只启动自己了解的本地工具程序。

## 参考资料

- [MCP 官方文档](https://modelcontextprotocol.io/docs/getting-started/intro)
- [C# MCP SDK](https://github.com/modelcontextprotocol/csharp-sdk)
