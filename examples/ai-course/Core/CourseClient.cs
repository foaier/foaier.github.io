using System.ClientModel;
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;
using OpenAI;

namespace AiCourse;

public static class CourseClient
{
    public static IChatClient Create()
    {
        var key = Required("AI_API_KEY");
        var model = Required("AI_MODEL");
        var endpoint = Environment.GetEnvironmentVariable("AI_ENDPOINT") ?? "https://api.openai.com/v1";
        var uri = new Uri(endpoint);
        if (uri.Scheme != "https" && !(uri.Scheme == "http" && uri.IsLoopback))
            throw new InvalidOperationException("模型地址应使用 HTTPS；本机实验可以使用 HTTP。 ");
        return new OpenAIClient(new ApiKeyCredential(key), new OpenAIClientOptions { Endpoint = uri })
            .GetChatClient(model).AsIChatClient();
    }

    public static AIAgent Agent(string instructions, params AITool[] tools) =>
        Create().AsAIAgent(instructions: instructions, name: "StudyAssistant", tools: tools);

    public static string Required(string name) => Environment.GetEnvironmentVariable(name)
        is { Length: > 0 } value ? value : throw new InvalidOperationException($"请先设置环境变量 {name}，见环境准备章节。");

    public static string StateFile(string name)
    {
        var directory = Path.Combine(Directory.GetCurrentDirectory(), ".state");
        Directory.CreateDirectory(directory);
        return Path.Combine(directory, name);
    }
}
