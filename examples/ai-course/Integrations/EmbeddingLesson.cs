using System.ClientModel;
using OpenAI;

namespace AiCourse.Integrations;

public static class EmbeddingLesson
{
    public static async Task Run()
    {
        var client = new OpenAIClient(new ApiKeyCredential(CourseClient.Required("AI_API_KEY")),
            new OpenAIClientOptions { Endpoint = new Uri(CourseClient.Required("AI_ENDPOINT")) })
            .GetEmbeddingClient(CourseClient.Required("AI_EMBEDDING_MODEL"));
        string[] texts = ["钱什么时候退回来？", "退款一般需要三个工作日到账。", "今天学习图片识别。"];
        var vectors = new List<float[]>();
        foreach (var text in texts)
            vectors.Add((await client.GenerateEmbeddingAsync(text)).Value.ToFloats().ToArray());
        Console.WriteLine($"维度：{vectors[0].Length}");
        for (var index = 1; index < texts.Length; index++)
            Console.WriteLine($"{Cosine(vectors[0], vectors[index]):F4} {texts[index]}");
    }

    public static double Cosine(float[] left, float[] right)
    {
        if (left.Length != right.Length || left.Length == 0) throw new ArgumentException("向量维度必须相同且非空。");
        double dot = 0, a = 0, b = 0;
        for (var index = 0; index < left.Length; index++)
        { dot += left[index] * right[index]; a += left[index] * left[index]; b += right[index] * right[index]; }
        if (a == 0 || b == 0) throw new ArgumentException("不能比较零向量。");
        return dot / Math.Sqrt(a * b);
    }
}
