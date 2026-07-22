using System.Text.Json.Serialization;

namespace QuizNest.Api.Models;

public class QuestionItem
{
    [JsonPropertyName("question")]
    public required string Question { get; set; }

    [JsonPropertyName("options")]
    public required string[] Options { get; set; }

    [JsonPropertyName("answer")]
    public required string Answer { get; set; }

    [JsonPropertyName("explanation")]
    public string? Explanation { get; set; }

    [JsonPropertyName("difficulty")]
    public string Difficulty { get; set; } = "medium";
}
