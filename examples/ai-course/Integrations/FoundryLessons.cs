using Azure.AI.Projects;
using Azure.Identity;
using Microsoft.Agents.AI;
using Microsoft.Agents.AI.Foundry;
using Azure.AI.Projects.Agents;

namespace AiCourse.Integrations;

public static class FoundryLessons
{
    public static AIProjectClient Project() => new(new Uri(CourseClient.Required("FOUNDRY_PROJECT_ENDPOINT")), new AzureCliCredential());
    public static AgentAdministrationClient Administration() => new(new Uri(CourseClient.Required("FOUNDRY_PROJECT_ENDPOINT")), new AzureCliCredential());
    public static async Task Chat()
    {
        var agent = Project().AsAIAgent(model: CourseClient.Required("FOUNDRY_MODEL_DEPLOYMENT"),
            name: "StudyCoach", instructions: "向初学者解释AI，每次一个例子。");
        Console.WriteLine(await agent.RunAsync("什么是向量搜索？"));
    }

    public static async Task Create()
    {
        var name = CourseClient.Required("FOUNDRY_AGENT_NAME");
        Console.Write($"将在Foundry创建 {name} 的一个新版本，输入 create 继续：");
        if (Console.ReadLine() != "create") return;
        var project = Project();
        var definition = ProjectsAgentDefinition.CreatePromptAgentDefinition(CourseClient.Required("FOUNDRY_MODEL_DEPLOYMENT"));
        definition.Instructions = "你是中文AI学习助手。每次给一个例子。";
        var created = await Administration().CreateAgentVersionAsync(name, new ProjectsAgentVersionCreationOptions(definition));
        var agent = project.AsAIAgent(created.Value);
        Console.WriteLine($"已创建版本：{created.Value.Name}:{created.Value.Version}");
        Console.WriteLine(await agent.RunAsync("解释训练和推理的区别。"));
    }

    public static async Task Existing()
    {
        var project = Project();
        var existing = await Administration().GetAgentAsync(CourseClient.Required("FOUNDRY_AGENT_NAME"));
        var agent = project.AsAIAgent(existing.Value);
        Console.WriteLine(await agent.RunAsync("用一个例子解释RAG。"));
    }

    public static async Task Memory()
    {
        var project = Project();
        // Foundry记忆在本版本中仍为实验能力；仅在这一段接受该标记。
#pragma warning disable MAAI001
        var memory = new FoundryMemoryProvider(project, CourseClient.Required("FOUNDRY_MEMORY_STORE"),
            _ => new FoundryMemoryProvider.State(new FoundryMemoryProviderScope("course-demo-learner")));
#pragma warning restore MAAI001
        // 先在Foundry控制台创建专用实验Memory Store；本例不自动新建或删除云资源。
        var agent = project.AsAIAgent(new ChatClientAgentOptions
        {
            ChatOptions = new() { ModelId = CourseClient.Required("FOUNDRY_MODEL_DEPLOYMENT"), Instructions = "使用已知学习偏好回答，不猜测。" },
            AIContextProviders = [memory],
        });
        var session = await agent.CreateSessionAsync();
        Console.Write("输入要记住的虚构偏好，或询问已有偏好：");
        Console.WriteLine(await agent.RunAsync(Console.ReadLine() ?? "你知道我的学习偏好吗？", session));
        Console.WriteLine("记忆更新是异步的。请在控制台确认完成，再用同一Scope重新运行查询。");
    }
}
