using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;

namespace AiCourse;

public static partial class Lessons
{
    public static AgentInlineSkill CreateInlineSkill() => new AgentInlineSkill(
        "study-plan", "为AI初学者安排短时学习计划", "先读取 plan-rule，再安排三步练习，每步写出可观察的结果。")
        .AddResource("plan-rule", "总时长不超过30分钟；先看例子，再修改输入，最后用自己的话解释。");

    public static async Task RunWithSkills(AgentSkillsProvider provider, string question = "帮我安排30分钟的AI入门练习。")
    {
        using var client = CourseClient.Create();
        var agent = client.AsAIAgent(new ChatClientAgentOptions
        {
            Name = "StudyCoach", ChatOptions = new() { Instructions = "使用适合任务的技能，给出简短中文答案。" },
            AIContextProviders = [provider],
        });
        Console.WriteLine(await agent.RunAsync(question));
    }

    public static Task InlineSkill() => RunWithSkills(new AgentSkillsProvider(CreateInlineSkill()));
    public static Task FileSkill() => RunWithSkills(new AgentSkillsProvider(Path.Combine(AppContext.BaseDirectory, "skills")), "请用生活例子解释RAG，再给一个小练习。");
    public static Task ClassSkill() => RunWithSkills(new AgentSkillsProvider(new StudyPlanSkill()));
    public static Task CombinedSkills() => RunWithSkills(new AgentSkillsProviderBuilder()
        .UseFileSkill(Path.Combine(AppContext.BaseDirectory, "skills"))
        .UseSkill(new StudyPlanSkill()).Build());
}

public sealed class StudyPlanSkill : AgentClassSkill<StudyPlanSkill>
{
    public override AgentSkillFrontmatter Frontmatter { get; } = new("study-plan", "为AI初学者安排短时学习计划");
    protected override string Instructions => "把学习拆成三个动作：阅读一个例子、修改一个输入、解释一个结果。每个动作10分钟。";
}
