---
title: "MCP HTTP 客户端：发现工具，再交给 Agent 调用"
date: "2026-11-20"
summary: "通过 HTTP 获取工具列表，定位协议与模型两层问题。"
series: "Agent Framework 进阶"
order: 29
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["mcp-web-api"]
goals: ["通过 HTTP 获取工具列表，定位协议与模型两层问题。"]
---

知道一个工具服务的网址后，Agent 还不知道有哪些函数。客户端先与 MCP 服务建立连接，读取工具定义，再把它们传给模型。服务返回的描述相当于菜单，模型选择菜品，宿主程序负责真正下单并把结果送回。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。请在当前终端配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY，并选择支持工具调用的模型。这里提供的是可编译示例；真实回答取决于模型服务，文字不会每次相同。 先在另一个终端启动 McpServer。MCP_ENDPOINT 默认 `http://localhost:5071/mcp`，也可指向你信任且可访问的兼容服务。

~~~powershell
dotnet run --project Integrations -- mcp-http
~~~

## 代码是怎样工作的

HttpClientTransport 指定端点，McpClient.CreateAsync 完成客户端初始化。AskMcp 调用 ListToolsAsync 打印工具名，再把工具转为 AITool 传给 Agent。模型决定是否查询课程，工具请求通过 MCP 传到服务端，返回值再进入回答。

```csharp
public static async Task McpHttp()
    {
        var address = Environment.GetEnvironmentVariable("MCP_ENDPOINT") ?? "`http://localhost:5071/mcp`";
        await using var client = await McpClient.CreateAsync(new HttpClientTransport(new() { Endpoint = new Uri(address) }));
        await AskMcp(client);
    }
```


```csharp
private static async Task AskMcp(McpClient client)
    {
        var tools = await client.ListToolsAsync();
        Console.WriteLine("发现工具：" + string.Join(", ", tools.Select(tool => tool.Name)));
        var agent = CourseClient.Agent("课程时长通过工具查询，不猜测。", [.. tools.Cast<AITool>()]);
        Console.WriteLine(await agent.RunAsync("AI入门需要学习多久？"));
    }
```


## 怎样判断成功

先看到发现工具的日志，然后看到AI入门课程约30分钟的回答。工具列表拿不到，应先排查协议连接；列表能拿到但没有调用，应检查模型能力和描述。不要把这两种失败都归结成“提示词不够好”。

## 自己改一次

在服务端增加一门课程后重新连接，检查客户端能否发现变化。再询问不存在的课程，确认返回未找到。最后停止服务，观察连接错误发生在哪个阶段，并给自己的应用设计明确提示。

## 遇到问题先看这里

MCP 端点不等于 REST 业务地址，不要填 /courses/AI入门。远程服务还可能要求认证与协议版本，不能只复制本机配置。工具说明来自服务端，应只连接受信任服务；重要操作仍需权限、参数校验和批准。

## 参考资料

- [MCP 官方文档](https://modelcontextprotocol.io/docs/getting-started/intro)
- [C# MCP SDK](https://github.com/modelcontextprotocol/csharp-sdk)
