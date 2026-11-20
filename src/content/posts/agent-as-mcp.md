---
title: "把 Agent 暴露为 MCP 工具：给第三方一个清楚的调用入口"
date: "2026-11-20"
summary: "在 MCP 工具方法内部调用 Agent，并限制输入与执行时间。"
series: "Agent Framework 进阶"
order: 32
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["agent-mcp-http","agent-composition"]
goals: ["在 MCP 工具方法内部调用 Agent，并限制输入与执行时间。"]
---

前面的工具返回固定课程数据，现在我们让一个工具调用教学 Agent，返回简短解释。这样其他支持 MCP 的客户端也能使用这项能力。外部看到的是一个有输入输出的工具，并不需要知道内部用了哪个模型或框架。

## 准备与运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载[完整示例](/downloads/ai-course.zip)，在解压后的 ai-course 目录运行。示例使用 .NET 10；依赖版本固定在项目文件中。请在当前终端配置 AI_ENDPOINT、AI_MODEL、AI_API_KEY，并选择支持工具调用的模型。这里提供的是可编译示例；真实回答取决于模型服务，文字不会每次相同。 服务启动后仍监听 localhost:5071；另一终端用 MCP 客户端发现新增的 Explain 工具。服务器终端需要模型配置，调用者只需要协议连接。

~~~powershell
dotnet run --project McpServer -- --agent
~~~

## 代码是怎样工作的

只有启动时显式传 --agent，服务才注册 AgentTools。Explain 检查主题长度，建立四十五秒取消边界，再创建模型客户端调用 Agent。每次调用独立处理，没有共享陌生用户的会话。取消令牌来自协议请求并向下传递，但服务提供方是否已经停止仍要按实际状态判断。

```csharp
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

工具列表中应新增解释能力。直接调用 Explain 应返回三句话左右的中文解释，并产生模型费用。只看到工具被发现，不能证明内部模型配置正确；要单独检查真实工具调用及失败响应。

## 自己改一次

传入空字符串和超过两百字的主题，确认在调用模型前被拒绝。然后使用正常主题，比较行为。将来若增加会话，应由经过认证的用户与会话标识确定范围，而不是允许调用者随意读别人的历史。

## 遇到问题先看这里

本机实验没有公网身份系统，不能直接称为完整安全网关。对外部署还需认证、限流、费用控制与审计。内部异常不要包含密钥；外部模型返回内容也不应未经处理当成 HTML 或可执行指令。

## 参考资料

- [MCP 官方文档](https://modelcontextprotocol.io/docs/getting-started/intro)
- [C# MCP SDK](https://github.com/modelcontextprotocol/csharp-sdk)
