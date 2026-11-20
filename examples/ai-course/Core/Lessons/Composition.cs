using System.ComponentModel;
using System.Diagnostics;
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.DependencyInjection;

namespace AiCourse;

public static partial class Lessons
{
    public static async Task NestedAgent()
    {
        using var client = CourseClient.Create();
        var specialist = client.AsAIAgent(name: "explain_rag", description: "解释RAG的工作步骤",
            instructions: "只解释RAG，用检索、证据、生成三个步骤说明。");
        var parent = client.AsAIAgent(name: "study_coach", instructions: "涉及RAG时调用专家工具，再给初学者一个练习。",
            tools: [specialist.AsAIFunction()]);
        Console.WriteLine(await parent.RunAsync("我想学RAG，给我一个解释和练习。"));
    }

    public static async Task SkillDi()
    {
        var services = new ServiceCollection();
        services.AddSingleton<StudyRules>();
        services.AddTransient<ConfiguredStudySkill>();
        using var container = services.BuildServiceProvider(validateScopes: true);
        using var scope = container.CreateScope();
        var skill = scope.ServiceProvider.GetRequiredService<ConfiguredStudySkill>();
        await RunWithSkills(new AgentSkillsProvider(skill));
    }

    public static async Task Plugin()
    {
        var services = new ServiceCollection();
        services.AddScoped<CourseCatalog>();
        using var container = services.BuildServiceProvider(validateScopes: true);
        using var scope = container.CreateScope();
        var catalog = scope.ServiceProvider.GetRequiredService<CourseCatalog>();
        using var client = CourseClient.Create();
        var agent = client.AsAIAgent(instructions: "课程时长必须查询目录。",
            tools: [AIFunctionFactory.Create(catalog.Find)]);
        Console.WriteLine(await agent.RunAsync("C#起步课程需要多久？"));
    }

    public static async Task Telemetry()
    {
        using var listener = new ActivityListener
        {
            ShouldListenTo = source => source.Name == "Foaier.Course",
            Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllData,
            ActivityStopped = activity => Console.WriteLine($"[trace] {activity.DisplayName} {activity.Duration.TotalMilliseconds:F0}ms {activity.Status}"),
        };
        ActivitySource.AddActivityListener(listener);
        using var client = CourseClient.Create();
        var agent = client.AsAIAgent(instructions: "用一句中文回答。")
            .AsBuilder().UseOpenTelemetry(sourceName: "Foaier.Course").Build();
        Console.WriteLine(await agent.RunAsync("什么是追踪信息？"));
    }

    public static async Task Plan()
    {
        using var todos = new TodoProvider();
        using var modes = new AgentModeProvider();
        using var client = CourseClient.Create();
        var agent = client.AsAIAgent(new ChatClientAgentOptions
        {
            Name = "Planner",
            ChatOptions = new() { Instructions = "只规划学习步骤，不执行外部操作。用待办工具记录三步计划。" },
            AIContextProviders = [todos, modes],
        });
        Console.WriteLine(await agent.RunAsync("帮我规划半小时的RAG学习，停在计划阶段。"));
    }
}

public sealed class StudyRules
{
    public string Instructions => "先举一个生活例子，再给一个小实验，最后让读者解释结果。每一步10分钟。";
}
public sealed class ConfiguredStudySkill(StudyRules rules) : AgentClassSkill<ConfiguredStudySkill>
{
    public override AgentSkillFrontmatter Frontmatter { get; } = new("configured-plan", "根据课程规则安排学习计划");
    protected override string Instructions => rules.Instructions;
}
public sealed class CourseCatalog
{
    [Description("查询课程时长，只读演示目录。")]
    public string Find([Description("课程名称")] string name) => name switch
    { "AI入门" => "30分钟", "C#起步" => "45分钟", _ => "未找到" };
}
