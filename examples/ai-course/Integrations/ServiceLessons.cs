using GitHub.Copilot;
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;
using ModelContextProtocol.Client;

namespace AiCourse.Integrations;

public static class ServiceLessons
{
    public static async Task CheckMcp()
    {
        await using var client = await McpClient.CreateAsync(new StdioClientTransport(new()
        { Name = "CourseCheck", Command = "dotnet", Arguments = ["run", "--no-build", "--project", "McpServer", "--", "--stdio"] }));
        var tools = await client.ListToolsAsync();
        var tool = tools.Single();
        var result = await client.CallToolAsync(tool.Name, new Dictionary<string, object?> { ["name"] = "AI入门" });
        var text = result.Content.OfType<ModelContextProtocol.Protocol.TextContentBlock>().Single().Text;
        if (result.IsError == true || text != "30分钟") throw new InvalidOperationException("MCP查询结果不符合预期。");
        if (Math.Abs(EmbeddingLesson.Cosine([1, 0], [1, 0]) - 1) > 0.00001)
            throw new InvalidOperationException("相似度计算错误。");
        Console.WriteLine("通过：真实MCP握手、工具发现和调用、余弦计算。没有调用模型。");
    }

    public static async Task Declarative()
    {
        using var client = CourseClient.Create();
        var yaml = """
            kind: Prompt
            name: StudyCoach
            description: 用具体例子帮助AI新手学习
            instructions: 请用中文回答。先举一个生活例子，再解释对应的技术名词。
            """;
        var factory = new ChatClientPromptAgentFactory(client);
        var agent = await factory.CreateFromYamlAsync(yaml)
            ?? throw new InvalidOperationException("没有创建出Agent，请检查YAML定义。");
        Console.WriteLine(await agent.RunAsync("什么是工具调用？"));
    }

    public static async Task Copilot()
    {
        await using var client = new CopilotClient();
        await client.StartAsync();
        // 默认不开放文件、Shell和URL权限；本练习只进行问答。
        var agent = client.AsAIAgent(sessionConfig: null);
        Console.WriteLine(await agent.RunAsync("用中文解释Agent Framework，不读取文件，不执行命令。"));
    }

    public static async Task McpHttp()
    {
        var address = Environment.GetEnvironmentVariable("MCP_ENDPOINT") ?? "http://localhost:5071/mcp";
        await using var client = await McpClient.CreateAsync(new HttpClientTransport(new() { Endpoint = new Uri(address) }));
        await AskMcp(client);
    }

    public static async Task McpStdio()
    {
        // 在ai-course根目录运行；由客户端启动并管理本地只读工具服务。
        await using var client = await McpClient.CreateAsync(new StdioClientTransport(new()
        { Name = "CourseTools", Command = "dotnet", Arguments = ["run", "--no-build", "--project", "McpServer", "--", "--stdio"] }));
        await AskMcp(client);
    }

    private static async Task AskMcp(McpClient client)
    {
        var tools = await client.ListToolsAsync();
        Console.WriteLine("发现工具：" + string.Join(", ", tools.Select(tool => tool.Name)));
        var agent = CourseClient.Agent("课程时长通过工具查询，不猜测。", [.. tools.Cast<AITool>()]);
        Console.WriteLine(await agent.RunAsync("AI入门需要学习多久？"));
    }
}
