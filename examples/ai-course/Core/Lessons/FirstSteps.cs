using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;

namespace AiCourse;

public static partial class Lessons
{
    public static async Task Chat()
    {
        using var client = CourseClient.Create();
        var response = await client.GetResponseAsync("请用两句话向新手解释什么是人工智能。");
        Console.WriteLine(response.Text);
    }

    public static async Task Agent()
    {
        var agent = CourseClient.Agent("你是学习助手。用中文解释概念，每次给一个生活中的例子。不知道时明确说不知道。");
        Console.WriteLine(await agent.RunAsync("什么是机器学习？"));
    }

    public static async Task Stream()
    {
        var agent = CourseClient.Agent("用中文，最多三句话。");
        await foreach (var update in agent.RunStreamingAsync("用做饭打比方解释训练和推理。"))
            Console.Write(update);
        Console.WriteLine();
    }

    public static async Task Session()
    {
        var agent = CourseClient.Agent("只根据当前会话回答，不知道用户信息时说不知道。");
        AgentSession alice = await agent.CreateSessionAsync();
        AgentSession bob = await agent.CreateSessionAsync();
        Console.WriteLine(await agent.RunAsync("我正在学 C#，这次练习的编号是 DEMO-001。", alice));
        Console.WriteLine("同一会话：" + await agent.RunAsync("练习编号是什么？", alice));
        Console.WriteLine("新会话：" + await agent.RunAsync("练习编号是什么？", bob));
    }

    public static async Task SaveSession()
    {
        var agent = CourseClient.Agent("根据会话回答问题，不知道的信息不要编造。");
        var file = CourseClient.StateFile("session.json");
        AgentSession session;
        if (File.Exists(file))
        {
            using var document = System.Text.Json.JsonDocument.Parse(await File.ReadAllTextAsync(file));
            session = await agent.DeserializeSessionAsync(document.RootElement);
            Console.WriteLine(await agent.RunAsync("我上次学习的主题是什么？", session));
        }
        else
        {
            session = await agent.CreateSessionAsync();
            Console.WriteLine(await agent.RunAsync("我这次学习的主题是向量搜索。", session));
        }
        var state = await agent.SerializeSessionAsync(session);
        await File.WriteAllTextAsync(file, state.GetRawText());
        Console.WriteLine("会话已保存。退出后再运行同一命令，观察第二次回答。");
    }
}
