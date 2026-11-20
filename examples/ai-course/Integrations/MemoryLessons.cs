using System.ClientModel;
using AiCourse;
using Microsoft.Agents.AI;
using Microsoft.Agents.AI.Valkey;
using Microsoft.Extensions.AI;
using Microsoft.SemanticKernel.Connectors.InMemory;
using OpenAI;
using Valkey.Glide;

namespace AiCourse.Integrations;

public static class MemoryLessons
{
    public static async Task History()
    {
        var embeddingClient = new OpenAIClient(new ApiKeyCredential(CourseClient.Required("AI_API_KEY")),
            new OpenAIClientOptions { Endpoint = new Uri(CourseClient.Required("AI_ENDPOINT")) })
            .GetEmbeddingClient(CourseClient.Required("AI_EMBEDDING_MODEL")).AsIEmbeddingGenerator();
        int dimensions = int.Parse(CourseClient.Required("AI_EMBEDDING_DIMENSIONS"));
        using var store = new InMemoryVectorStore(new() { EmbeddingGenerator = embeddingClient });
        var memory = new ChatHistoryMemoryProvider(store, "course-history", dimensions,
            _ => new ChatHistoryMemoryProvider.State(
                storageScope: new() { UserId = "demo-learner", SessionId = Guid.NewGuid().ToString("N") },
                searchScope: new() { UserId = "demo-learner" }),
            options: new() { MaxResults = 3, EnableSensitiveTelemetryData = false });
        using var client = CourseClient.Create();
        var agent = client.AsAIAgent(new ChatClientAgentOptions
        { ChatOptions = new() { Instructions = "根据已知的学习偏好回答，不知道就说不知道。" }, AIContextProviders = [memory] });
        var first = await agent.CreateSessionAsync();
        Console.WriteLine(await agent.RunAsync("我喜欢用C#做例子，每天学习20分钟。", first));
        var second = await agent.CreateSessionAsync();
        Console.WriteLine(await agent.RunAsync("请按我的偏好推荐今天怎么学。", second));
        Console.WriteLine("这个实验使用内存向量存储；进程退出后，存储内容会消失。");
    }

    public static async Task Valkey()
    {
        using var connection = await ConnectionMultiplexer.ConnectAsync(
            Environment.GetEnvironmentVariable("VALKEY_CONNECTION") ?? "localhost:6379");
        var provider = new ValkeyChatHistoryProvider(connection,
            _ => new ValkeyChatHistoryProvider.State("demo-learner:conversation-1"),
            new() { KeyPrefix = "foaier_course", MaxMessages = 20 });
        using var client = CourseClient.Create();
        var agent = client.AsAIAgent(new ChatClientAgentOptions
        { ChatOptions = new() { Instructions = "根据会话回答，不知道就说不知道。" }, ChatHistoryProvider = provider });
        var session = await agent.CreateSessionAsync();
        Console.Write("输入一句话（第二次运行可问上次学了什么）：");
        Console.WriteLine(await agent.RunAsync(Console.ReadLine() ?? "我上次学了什么？", session));
        Console.WriteLine("消息条数：" + await provider.GetMessageCountAsync(session));
    }
}
