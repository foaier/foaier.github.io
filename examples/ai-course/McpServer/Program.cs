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
