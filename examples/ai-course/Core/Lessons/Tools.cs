using System.ComponentModel;
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;

namespace AiCourse;

public static partial class Lessons
{
    [Description("查询演示课程的学习时长，返回分钟数。课程名称只支持 AI入门 和 C#起步。")]
    public static string FindLesson([Description("课程名称")] string name)
    {
        Console.WriteLine($"[工具被调用] FindLesson({name})");
        return name switch { "AI入门" => "30 分钟", "C#起步" => "45 分钟", _ => "没有找到这门课程" };
    }

    public static async Task Tools()
    {
        var agent = CourseClient.Agent("课程时长必须调用工具查询，不要猜。", AIFunctionFactory.Create(FindLesson));
        Console.WriteLine(await agent.RunAsync("AI入门和C#起步各需要多久？"));
    }

    public static async Task Approval()
    {
        var tool = new ApprovalRequiredAIFunction(AIFunctionFactory.Create(
            ([Description("要加入本次学习计划的主题")] string topic) => $"演示计划已加入：{topic}",
            name: "AddStudyPlan", description: "修改演示学习计划。"));
        var agent = CourseClient.Agent("添加学习计划必须使用工具。", tool);
        var session = await agent.CreateSessionAsync();
        AgentResponse response = await agent.RunAsync("把学习RAG加入计划。", session);
        for (int round = 0; round < 5; round++)
        {
            var pending = response.Messages.SelectMany(m => m.Contents).OfType<ToolApprovalRequestContent>().ToList();
            if (pending.Count == 0) { Console.WriteLine(response); return; }
            var answers = new List<AIContent>();
            foreach (var request in pending)
            {
                var call = (FunctionCallContent)request.ToolCall;
                Console.WriteLine($"申请执行 {call.Name}：{System.Text.Json.JsonSerializer.Serialize(call.Arguments)}");
                Console.Write("输入 yes 同意，其余输入拒绝：");
                bool approved = string.Equals(Console.ReadLine(), "yes", StringComparison.OrdinalIgnoreCase);
                answers.Add(request.CreateResponse(approved));
            }
            response = await agent.RunAsync(new ChatMessage(ChatRole.User, answers), session);
        }
        throw new InvalidOperationException("审批轮数超过练习上限，停止本次运行。");
    }

    public static async Task Structured()
    {
        var agent = CourseClient.Agent("提取学习需求，缺少的信息写进 MissingInformation，不要自行补充。 ");
        var response = await agent.RunAsync<StudyRequest>("我想学AI，会一点C#，但还没决定每天学多久。");
        var request = response.Result;
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(request));
        if (string.IsNullOrWhiteSpace(request.Topic)) throw new InvalidOperationException("缺少学习主题。");
    }
}

public sealed class StudyRequest
{
    public string Topic { get; set; } = "";
    public string[] KnownSkills { get; set; } = [];
    public string[] MissingInformation { get; set; } = [];
}
