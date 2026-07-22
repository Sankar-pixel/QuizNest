using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using QuizNest.Api.Models;

namespace QuizNest.Api.Services;

public class OllamaService
{
    private readonly HttpClient _client;
    private readonly OllamaOptions _options;

    public OllamaService(HttpClient client, OllamaOptions options)
    {
        _client = client;
        _options = options;
    }

    public async Task<string> GenerateQuestionAsync(string subject, int count = 1)
    {
        var prompt = BuildPrompt(subject, count);
        var requestBody = new
        {
            model = _options.Model,
            prompt = prompt,
            stream = false,
            temperature = 0.7,
            top_p = 0.95,
            max_length = 600,
            stop = new[] { "###" }
        };

        var requestJson = JsonSerializer.Serialize(requestBody);
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(new Uri(_options.Host), "/v1/chat/completions"));
        request.Content = new StringContent(requestJson, Encoding.UTF8, "application/json");

        using var response = await _client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();

        var responseContent = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(responseContent);
        var message = document.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();

        if (string.IsNullOrEmpty(message))
            throw new InvalidOperationException("Ollama returned an empty completion.");

        return message.Trim();
    }

    private static string BuildPrompt(string subject, int count)
    {
        return "Generate " + count + " multiple-choice quiz question(s) in JSON array format for the subject '" + subject + "'.\n" +
               "Each item must have these properties:\n" +
               "- question: string\n" +
               "- options: array of 4 strings\n" +
               "- answer: the correct option string\n" +
               "- explanation: a short explanation\n" +
               "- difficulty: one of 'easy', 'medium', 'hard'\n\n" +
               "Respond with only valid JSON and no additional text.\n\n" +
               "Example:\n" +
               "[\n" +
               "  {\n" +
               "    \"question\": \"What is ...?\",\n" +
               "    \"options\": [\"A\", \"B\", \"C\", \"D\"],\n" +
               "    \"answer\": \"B\",\n" +
               "    \"explanation\": \"...\",\n" +
               "    \"difficulty\": \"medium\"\n" +
               "  }\n" +
               "]\n\n" +
               "Now generate " + count + " questions for: " + subject;
    }
}
