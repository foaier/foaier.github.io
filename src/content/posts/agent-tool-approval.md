---
title: "人工审批：Agent 想执行操作，先把决定交给人"
date: "2026-11-20"
summary: "使用 ApprovalRequiredAIFunction 暂停工具执行"
series: "Agent Framework 入门"
order: 7
tags: ["Agent Framework 入门","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["agent-function-tools","sessions-memory"]
goals: ["使用 ApprovalRequiredAIFunction 暂停工具执行","处理同意、拒绝与再次申请，观察真实执行结果"]
---

读数据与修改数据的影响不同。上一课查询课程时长，这一课让Agent把一个主题加入演示学习计划。我们先让它展示准备执行的函数和参数，再从终端读取你的明确决定。

## 审批不是提示词里的客气话

只在指令中写“执行前请询问用户”，不能形成可靠的程序关卡。框架提供ApprovalRequiredAIFunction，把函数包装为需要审批的工具。第一次运行可能返回审批请求，而不是工具执行结果。

调用方要展示请求、收集选择、创建审批响应，再使用同一个Session继续。必须把拒绝也作为正常流程处理，不能因为用户没有输入就默认同意。我们的实验只有模拟计划，不会修改真实账号或外部系统。

## 准备并运行

先完成[环境准备](/articles/dotnet-ai-setup/)，下载并解压[课程示例](/downloads/ai-course.zip)。在解压后的 ai-course 目录打开终端。本篇使用 .NET 10，核心包 Microsoft.Agents.AI 1.28.0；依赖版本已写在项目文件中。

```powershell
dotnet run --project Core -- approval
```

需要在线模型的练习，请先在当前终端设置 AI_ENDPOINT、AI_MODEL、AI_API_KEY。不要把网页聊天产品的登录密码当作 API Key。模型调用会消耗所选服务的额度；本地模型则需要相应硬件和运行服务。

## 阅读完整的审批循环

代码位于Core/Lessons/Tools.cs。不是只取第一个请求，而是处理本轮所有ToolApprovalRequestContent；后续模型仍然可能申请其他工具，因此整个过程设置了轮数上限。

```csharp
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
```


读取终端输入后，只有yes会产生同意响应。按回车、输入no或者其他内容都会拒绝。工具名和参数来自框架请求内容，真正的业务界面还应翻译成读者能理解的操作说明，例如修改哪个计划、增加什么主题。

## 两种结果都要试

第一次运行输入yes，预期执行模拟函数并得到计划已加入的结果。第二次重新运行，输入no，预期不执行修改。观察的是程序有没有收到正确决定以及函数有没有执行，不能只凭模型最后的礼貌措辞判断。

如果模型没有提出工具请求，而是直接文字回答，请检查当前模型是否支持工具，以及指令是否明确要求实际调用。演示不会把“模型说已完成”当作工具完成，也不会为了生成漂亮结果自动通过审批。

## 审批与权限分别负责什么

审批表达某个人是否同意这一次具体动作。权限决定这个人是否有资格批准或执行它。普通用户点了同意，也不能获得管理员能力。正式系统要把待审批请求与用户、会话、工具参数绑定，防止串单和重复执行。

还要考虑用户很久不响应、页面断开或服务重启。本篇只在终端里等待，因此是最小实验；需要跨重启恢复时，应持久化待处理状态，并参照可恢复人工输入工作流。不要简单把终端读取替换成一个无限等待的HTTP请求。

## 小练习

把模拟函数改成“删除演示计划中的一项”，仍然只操作内存里的虚构数据。先记录预期变化，再分别同意和拒绝，检查结果。不要一开始就连接真实删除接口。

能解释为什么必须复用Session、为什么需要处理拒绝、为什么要限制审批循环，就可以继续学习结构化输出。它解决的是“程序如何读取模型给出的字段”，与是否允许执行是另一层问题。

## 参考资料

- [工具审批](https://learn.microsoft.com/en-us/agent-framework/agents/tools/tool-approval)
- [工作流人工输入](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop)
