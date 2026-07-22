namespace QuizNest.Api.Models;

public class OllamaOptions
{
    public string Host { get; set; } = "http://127.0.0.1:11434";
    public string Model { get; set; } = "qwen-2.5-7b-instruct";
    public int TimeoutSeconds { get; set; } = 120;
}
