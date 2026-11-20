using System.Diagnostics;
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.DependencyInjection;

namespace AiCourse;

public static partial class Lessons
{
    public static async Task DependencyInjection()
    {
        var services = new ServiceCollection();
        services.AddSingleton<IChatClient>(_ => CourseClient.Create());
        services.AddTransient<AIAgent>(provider => provider.GetRequiredService<IChatClient>()
            .AsAIAgent(instructions: "用中文解释一个AI概念。", name: "StudyCoach"));
        using var container = services.BuildServiceProvider(validateScopes: true);
        using var scope = container.CreateScope();
        var agent = scope.ServiceProvider.GetRequiredService<AIAgent>();
        Console.WriteLine(await agent.RunAsync("什么是依赖注入？用奶茶店举例。"));
    }

    public static async Task Middleware()
    {
        using var client = new TimingChatClient(CourseClient.Create());
        var agent = client.AsAIAgent(instructions: "简短回答。", name: "TimedAgent");
        Console.WriteLine(await agent.RunAsync("解释一次模型请求经过哪些步骤。"));
    }

    public static async Task Vision()
    {
        var file = CourseClient.Required("AI_IMAGE_FILE");
        var bytes = await File.ReadAllBytesAsync(file);
        string mime = Path.GetExtension(file).ToLowerInvariant() switch
        { ".png" => "image/png", ".jpg" or ".jpeg" => "image/jpeg", _ => throw new InvalidOperationException("练习支持PNG或JPEG。") };
        if (bytes.Length > 5_000_000) throw new InvalidOperationException("练习图片请小于5MB。");
        var agent = CourseClient.Agent("只描述图中可见内容，模糊的文字要注明看不清。");
        var message = new ChatMessage(ChatRole.User, [new TextContent("这张图里有什么？"), new DataContent(bytes, mime)]);
        Console.WriteLine(await agent.RunAsync(message));
    }
}

public sealed class TimingChatClient(IChatClient inner) : DelegatingChatClient(inner)
{
    public override async Task<ChatResponse> GetResponseAsync(IEnumerable<ChatMessage> messages,
        ChatOptions? options = null, CancellationToken cancellationToken = default)
    {
        var timer = Stopwatch.StartNew();
        try { return await base.GetResponseAsync(messages, options, cancellationToken); }
        finally { Console.WriteLine($"[模型调用] {timer.ElapsedMilliseconds} ms"); }
    }
}
