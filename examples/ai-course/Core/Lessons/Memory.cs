using Microsoft.Extensions.AI;
using Microsoft.Agents.AI;

namespace AiCourse;

public static partial class Lessons
{
    public static async Task FileMemory()
    {
        var root = CourseClient.StateFile("memory");
        Directory.CreateDirectory(root);
        // 文件系统存储在此固定版本中仍标为实验 API。
#pragma warning disable MAAI001
        var store = new FileSystemAgentFileStore(root);
#pragma warning restore MAAI001
        using var provider = new FileMemoryProvider(store, _ => new FileMemoryState { WorkingFolder = "users/demo-learner" });
        using var client = CourseClient.Create();
        var agent = client.AsAIAgent(new ChatClientAgentOptions
        {
            ChatOptions = new() { Instructions = "你是学习助手。使用记忆工具保存用户明确要求记住的偏好；回答前读取已有偏好。" },
            AIContextProviders = [provider],
        });
        var first = await agent.CreateSessionAsync();
        Console.WriteLine(await agent.RunAsync("请记住：我的学习语言是C#，喜欢先看例子再看术语。", first));
        Console.WriteLine("当前记忆文件：");
        foreach (var filename in Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories))
            Console.WriteLine(Path.GetRelativePath(root, filename));
        var second = await agent.CreateSessionAsync();
        Console.WriteLine(await agent.RunAsync("我喜欢怎样学习？请先读取记忆再回答。", second));
    }

    public static async Task Reduce()
    {
        using var client = CourseClient.Create();
        var messages = new List<ChatMessage>
        {
            new(ChatRole.System, "只根据提供的对话回答，不知道时说不知道。"),
            new(ChatRole.User, "我的练习编号是 DEMO-001。"),
            new(ChatRole.Assistant, "记住了。"),
            new(ChatRole.User, "今天学习会话。"),
            new(ChatRole.Assistant, "可以先试两轮对话。"),
        };
        // 此版本的 reducer 标记为实验 API；练习固定包版本，并只在这里接受该标记。
#pragma warning disable MEAI001
        var reducer = new MessageCountingChatReducer(2);
        var reduced = (await reducer.ReduceAsync(messages, CancellationToken.None))?.ToList() ?? messages;
#pragma warning restore MEAI001
        reduced.Add(new(ChatRole.User, "我的练习编号是什么？"));
        Console.WriteLine($"裁剪前 {messages.Count} 条，提问前保留 {reduced.Count - 1} 条。");
        Console.WriteLine((await client.GetResponseAsync(reduced)).Text);
    }
}
